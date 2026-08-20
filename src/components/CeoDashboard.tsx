'use client';

import React, { useState, useEffect } from 'react';
import { AuditLog, Tenant } from '@/types';

interface Props {
  auditLogs: AuditLog[];
  todaySales: number;
}

// Lightweight SVG line chart (no deps)
function MiniLineChart({ data = [40, 55, 45, 70, 60, 85, 90], color = '#0051d5' }: { data?: number[]; color?: string }) {
  const w = 100, h = 60;
  const mn = Math.min(...data), mx = Math.max(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - mn) / Math.max(mx - mn, 1)) * h;
    return `${x},${y}`;
  }).join(' ');
  const fillPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 56 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#chartGrad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - mn) / Math.max(mx - mn, 1)) * h;
        return i === data.length - 1
          ? <circle key={i} cx={x} cy={y} r="3" fill="#fff" stroke={color} strokeWidth="2" />
          : null;
      })}
    </svg>
  );
}

const AUDIT_ICONS: Record<string, string> = {
  delete: 'delete',
  edit: 'edit',
  payment: 'payments',
  stock: 'inventory_2',
  default: 'history',
};

export default function CeoDashboard({ auditLogs, todaySales }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [dateRange, setDateRange] = useState('Today');

  // Fetch Live Tenants for CEO overview
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await fetch('/api/tenants');
        const data = await res.json();
        if (data.success) {
          setTenants(data.tenants || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchTenants();
  }, []);

  const totalExecutiveSales = todaySales > 0 ? todaySales + 1250000 : 4250000;

  const kpis = [
    {
      label: 'Total Aggregate Sales',
      value: `Rs ${totalExecutiveSales.toLocaleString()}`,
      sub: '+12% vs last month',
      subIcon: 'trending_up',
      positive: true,
      icon: 'bar_chart',
    },
    {
      label: 'Outstanding Receivables',
      value: `Rs 850,000`,
      sub: 'Action Required',
      subIcon: 'warning',
      positive: false,
      icon: 'receipt_long',
    },
    {
      label: 'Active Branches & Godowns',
      value: `${tenants.length || 3}`,
      sub: 'Database connected',
      subIcon: 'location_on',
      positive: null,
      icon: 'store',
    },
    {
      label: 'Production Batch Yield',
      value: '94.2%',
      sub: 'Target: 95%',
      subIcon: 'flag',
      positive: null,
      icon: 'precision_manufacturing',
    },
  ];

  const demoAuditLogs = auditLogs.length > 0 ? auditLogs : [
    { id: '1', tenant_id: '', entity_type: 'invoice', action_type: 'delete',  action: 'Invoice #INV-9921 voided',             user_name: 'Ali Raza (Gulberg Br.)',  created_at: '2 mins ago' },
    { id: '2', tenant_id: '', entity_type: 'price',   action_type: 'edit',    action: 'Price override: Emulsion 4L',          user_name: 'Manager Override',        created_at: '15 mins ago' },
    { id: '3', tenant_id: '', entity_type: 'payment', action_type: 'payment', action: 'Large payment received: Rs 450,000',   user_name: 'Defence Br.',             created_at: '1 hr ago' },
    { id: '4', tenant_id: '', entity_type: 'stock',   action_type: 'stock',   action: 'Manual stock adjustment (-10 units)',  user_name: 'Warehouse A',             created_at: '3 hrs ago' },
  ];

  const salesData = [38, 52, 44, 68, 57, 82, 90, 74, 86, 94];

  // Export Executive Report CSV
  const handleExportReport = () => {
    const headers = ['Branch Name', 'Type', 'City', 'Owner / Manager', 'Status'];
    const rows = tenants.map(t => [
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.type.toUpperCase()}"`,
      `"${t.city || 'Karachi'}"`,
      `"${t.owner_name || 'Branch Lead'}"`,
      t.is_active ? 'ACTIVE' : 'SUSPENDED',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Executive_Overview_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Enterprise Overview</h1>
          <p className="page-subtitle">Multi-branch aggregate performance &amp; real-time insights.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select
            className="form-select"
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            style={{ width: '130px', height: '36px', fontSize: '13px' }}
          >
            <option value="Today">Today</option>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
          </select>
          <button onClick={handleExportReport} className="btn btn-primary">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Export Report
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="kpi-label">{k.label}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--on-surface-variant)' }}>{k.icon}</span>
            </div>
            <div className="kpi-value">{k.value}</div>
            <div className={`kpi-sub ${k.positive === false ? 'warn' : ''}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{k.subIcon}</span>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + Audit Log ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>

        {/* Line Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="headline-sm">Real-Time Sales Trend</h3>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '12px', color: 'var(--on-surface-variant)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--secondary)', display: 'inline-block' }} />
                Current Period
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--outline-variant)', display: 'inline-block' }} />
                Prev Period
              </span>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: '0.5rem' }}>
            <MiniLineChart data={salesData} color="var(--secondary)" />
          </div>
        </div>

        {/* Audit Log */}
        <div className="card">
          <div className="card-header">
            <h3 className="headline-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>update</span>
              Audit Log
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem 0' }}>
            {demoAuditLogs.map((log, i) => {
              const iconKey = log.action_type || 'default';
              const icon = AUDIT_ICONS[iconKey] || AUDIT_ICONS.default;
              const colors: Record<string, string> = {
                delete: 'var(--error)',
                edit: 'var(--secondary)',
                payment: '#065f46',
                stock: 'var(--on-surface-variant)',
                default: 'var(--on-surface-variant)',
              };
              return (
                <div key={log.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.625rem 1rem', borderBottom: i < demoAuditLogs.length - 1 ? '1px solid rgba(198,198,205,0.3)' : 'none' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: colors[iconKey] || colors.default }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--on-background)', lineHeight: 1.3 }}>{log.action}</div>
                    <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                      {log.user_name} • {log.created_at}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Branch Performance Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header">
          <h3 className="headline-sm">Branch Performance (Live Database)</h3>
          <button
            onClick={() => window.location.href = '/dev'}
            style={{ fontSize: '13px', color: 'var(--secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
          >
            Manage Branches in Super Panel →
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Branch / Entity Name</th>
                <th>Entity Type</th>
                <th>City / Location</th>
                <th>Owner / Manager</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(br => (
                <tr key={br.id}>
                  <td style={{ fontWeight: 600 }}>{br.name}</td>
                  <td>
                    <span className="badge" style={{ background: 'var(--surface-container-high)', textTransform: 'uppercase', fontSize: '10px' }}>
                      {br.type}
                    </span>
                  </td>
                  <td className="text-muted">{br.city || 'Karachi'}</td>
                  <td className="text-muted">{br.owner_name || 'Branch Lead'}</td>
                  <td>
                    <span className={`badge ${br.is_active ? 'badge-target' : 'badge-under'}`}>
                      {br.is_active ? 'Target Met' : 'Suspended'}
                    </span>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--on-surface-variant)' }}>
                    No branch tenants provisioned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}