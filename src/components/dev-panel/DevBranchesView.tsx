'use client';

import React, { useState } from 'react';
import { 
  Building2, 
  Store, 
  Warehouse, 
  Factory, 
  Plus, 
  Copy, 
  Check, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  XCircle,
  Users,
  Search
} from 'lucide-react';
import { Tenant, BranchType } from '@/types/dev';

interface DevBranchesViewProps {
  branches: Tenant[];
  onAddBranch: () => void;
  onEditBranch: (branch: Tenant) => void;
  onDeleteBranch: (id: string) => void;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
  onOpenBranchPortal: (branch: Tenant) => void;
  onAddCounterToBranch: (branch: Tenant) => void;
}

export const DevBranchesView: React.FC<DevBranchesViewProps> = ({
  branches,
  onAddBranch,
  onEditBranch,
  onDeleteBranch,
  onToggleStatus,
  onOpenBranchPortal,
  onAddCounterToBranch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | BranchType>('all');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredBranches = branches.filter((b) => {
    const matchesQuery = 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.phone || '').includes(searchQuery);

    const matchesType = typeFilter === 'all' || b.type === typeFilter;
    return matchesQuery && matchesType;
  });

  const retailShopsCount = branches.filter((b) => b.type === 'shop').length;
  const godownsCount = branches.filter((b) => b.type === 'godown').length;
  const factoriesCount = branches.filter((b) => b.type === 'factory').length;

  const handleCopySlug = (slug: string) => {
    const fullUrl = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const getBranchIcon = (type: string) => {
    switch (type) {
      case 'shop':
        return <Store style={{ width: '20px', height: '20px', color: '#fbbf24' }} />;
      case 'godown':
        return <Warehouse style={{ width: '20px', height: '20px', color: '#34d399' }} />;
      case 'factory':
        return <Factory style={{ width: '20px', height: '20px', color: '#facc15' }} />;
      default:
        return <Building2 style={{ width: '20px', height: '20px', color: '#D4AF37' }} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 300, color: '#ffffff', letterSpacing: '-0.025em', margin: '0 0 4px' }}>
            Branches & <span style={{ color: '#D4AF37', fontWeight: 700 }}>Godowns</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
            Manage shops, wholesale godowns, and manufacturing factories
          </p>
        </div>

        <button
          onClick={onAddBranch}
          className="aura-btn-gold"
        >
          <Plus style={{ width: '16px', height: '16px', strokeWidth: 3 }} />
          <span>+ Provision Shop / Godown</span>
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="aura-grid-3">
        {/* Retail Shops Box */}
        <div 
          onClick={() => setTypeFilter(typeFilter === 'shop' ? 'all' : 'shop')}
          className="aura-card aura-card-hover"
          style={{
            cursor: 'pointer',
            borderColor: typeFilter === 'shop' ? '#D4AF37' : 'rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>
              Retail Shops
            </span>
            <Store style={{ width: '20px', height: '20px', color: '#D4AF37' }} />
          </div>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#ffffff', margin: 0 }}>{retailShopsCount}</p>
          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' }}>Point of Sale & Retail Outlets</p>
        </div>

        {/* Central Godowns Box */}
        <div 
          onClick={() => setTypeFilter(typeFilter === 'godown' ? 'all' : 'godown')}
          className="aura-card aura-card-hover"
          style={{
            cursor: 'pointer',
            borderColor: typeFilter === 'godown' ? '#34d399' : 'rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>
              Central Godowns
            </span>
            <Warehouse style={{ width: '20px', height: '20px', color: '#34d399' }} />
          </div>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#D4AF37', margin: 0 }}>{godownsCount}</p>
          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' }}>Wholesale Inventory Storage Hubs</p>
        </div>

        {/* Paint Factories Box */}
        <div 
          onClick={() => setTypeFilter(typeFilter === 'factory' ? 'all' : 'factory')}
          className="aura-card aura-card-hover"
          style={{
            cursor: 'pointer',
            borderColor: typeFilter === 'factory' ? '#facc15' : 'rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>
              Paint Factories
            </span>
            <Factory style={{ width: '20px', height: '20px', color: '#facc15' }} />
          </div>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#ffffff', margin: 0 }}>{factoriesCount}</p>
          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' }}>Manufacturing & Chemical Plants</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search style={{ width: '16px', height: '16px', color: '#9ca3af', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search branches by name, city, phone..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(['all', 'shop', 'godown', 'factory'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: typeFilter === t ? '#D4AF37' : 'rgba(255, 255, 255, 0.05)',
                color: typeFilter === t ? '#000000' : '#9ca3af',
              }}
            >
              {t === 'all' ? 'All Types' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Branches List Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredBranches.length === 0 ? (
          <div className="aura-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <Building2 style={{ width: '40px', height: '40px', color: 'rgba(212, 175, 55, 0.4)', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px' }}>No Branches Found</h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 16px' }}>Create your retail outlets, storage godowns, and factories.</p>
            <button onClick={onAddBranch} className="aura-btn-gold">Add First Branch</button>
          </div>
        ) : (
          filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className="aura-card aura-card-hover"
              style={{
                opacity: branch.is_active ? 1 : 0.7,
                borderColor: !branch.is_active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                {/* Branch Details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getBranchIcon(branch.type)}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                        {branch.name}
                      </h3>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(212, 175, 55, 0.15)',
                          color: '#D4AF37',
                          border: '1px solid rgba(212, 175, 55, 0.3)',
                        }}
                      >
                        {branch.type.toUpperCase()}
                      </span>
                      {branch.city && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9ca3af' }}>
                          <MapPin style={{ width: '12px', height: '12px', color: '#f87171' }} />
                          <span>{branch.city}</span>
                        </span>
                      )}
                      {!branch.is_active && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          SUSPENDED
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '12px', color: '#D4AF37', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, margin: '2px 0 0' }}>
                      /{branch.slug}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#9ca3af', marginTop: '4px', flexWrap: 'wrap' }}>
                      {branch.owner_name && <span>Mgr: <strong style={{ color: '#d1d5db' }}>{branch.owner_name}</strong> •</span>}
                      {branch.address && <span>{branch.address} •</span>}
                      {branch.phone && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d1d5db', fontFamily: "'JetBrains Mono', monospace" }}>
                          <Phone style={{ width: '12px', height: '12px', color: '#D4AF37' }} />
                          {branch.phone} •
                        </span>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                        <Users style={{ width: '12px', height: '12px' }} />
                        {branch.usersCount || branch.staffCount || 0} staff
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action Icons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Status Toggle */}
                  <button
                    onClick={() => onToggleStatus(branch.id, branch.is_active)}
                    style={{
                      padding: '8px',
                      borderRadius: '12px',
                      backgroundColor: branch.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${branch.is_active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      color: branch.is_active ? '#34d399' : '#f87171',
                      cursor: 'pointer',
                    }}
                    title={branch.is_active ? 'Active - Click to Suspend' : 'Suspended - Click to Activate'}
                  >
                    {branch.is_active ? <CheckCircle2 style={{ width: '16px', height: '16px' }} /> : <XCircle style={{ width: '16px', height: '16px' }} />}
                  </button>

                  {/* Copy Slug */}
                  <button
                    onClick={() => handleCopySlug(branch.slug)}
                    className="aura-btn-secondary"
                    style={{ padding: '8px', borderRadius: '12px' }}
                    title="Copy full branch URL"
                  >
                    {copiedSlug === branch.slug ? <Check style={{ width: '16px', height: '16px', color: '#34d399' }} /> : <Copy style={{ width: '16px', height: '16px' }} />}
                  </button>

                  {/* Add Counter / Branch Button */}
                  <button
                    onClick={() => onAddCounterToBranch(branch)}
                    className="aura-btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '12px', borderColor: 'rgba(96, 165, 250, 0.4)', color: '#60a5fa' }}
                    title="Add a new counter or branch login to this shop"
                  >
                    <Plus style={{ width: '14px', height: '14px', color: '#60a5fa' }} />
                    <span>Add Counter</span>
                  </button>

                  {/* Workspace Modal */}
                  <button
                    onClick={() => onOpenBranchPortal(branch)}
                    className="aura-btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    <ExternalLink style={{ width: '14px', height: '14px', color: '#D4AF37' }} />
                    <span>Workspace</span>
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => onEditBranch(branch)}
                    className="aura-btn-secondary"
                    style={{ padding: '8px', borderRadius: '12px' }}
                    title="Edit Branch"
                  >
                    <Edit3 style={{ width: '16px', height: '16px' }} />
                  </button>

                  {/* Delete */}
                  {deleteConfirmId === branch.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => {
                          onDeleteBranch(branch.id);
                          setDeleteConfirmId(null);
                        }}
                        style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        style={{ padding: '6px 10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#d1d5db', fontSize: '11px', border: 'none', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(branch.id)}
                      className="aura-btn-danger"
                      style={{ padding: '8px', borderRadius: '12px' }}
                      title="Delete Branch"
                    >
                      <Trash2 style={{ width: '16px', height: '16px' }} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
