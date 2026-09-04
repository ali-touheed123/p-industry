import React, { useState, useEffect } from 'react';
import { Store, Check, RefreshCw, Layers, ShieldCheck, Printer, ArrowRight } from 'lucide-react';
import { ReceiptTemplate } from '@/types/receipt';

interface TenantAssignmentRow {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_type: string;
  is_active: boolean;
  template_id: string | null;
  template_name: string | null;
  paper_size: string | null;
}

interface DevTemplateAssignViewProps {
  templates: ReceiptTemplate[];
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
  onPreviewTemplate: (template: ReceiptTemplate, tenantName?: string) => void;
}

export const DevTemplateAssignView: React.FC<DevTemplateAssignViewProps> = ({
  templates,
  onShowToast,
  onPreviewTemplate,
}) => {
  const [assignments, setAssignments] = useState<TenantAssignmentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingTenantId, setSavingTenantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/receipt-templates/assign');
      const data = await res.json();
      if (data.success) {
        setAssignments(data.assignments || []);
      } else {
        onShowToast(data.error || 'Failed to fetch assignments', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Error loading branch assignments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleAssign = async (tenantId: string, templateId: string) => {
    try {
      setSavingTenantId(tenantId);
      const res = await fetch('/api/receipt-templates/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          template_id: templateId === '__default__' ? null : templateId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast(
          templateId === '__default__'
            ? 'Branch reverted to Platform Default template'
            : 'Template assigned to branch successfully!'
        );
        fetchAssignments();
      } else {
        onShowToast(data.error || 'Failed to update assignment', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Error assigning template', 'error');
    } finally {
      setSavingTenantId(null);
    }
  };

  const defaultTemplate = templates.find((t) => t.is_default) || templates[0];

  const filtered = assignments.filter((a) =>
    a.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.tenant_slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(20, 20, 20, 0.6) 100%)',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          borderRadius: '16px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(212, 175, 55, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D4AF37',
            }}
          >
            <Layers style={{ width: 24, height: 24 }} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Enterprise Branch Layout Distribution
            </h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '4px 0 0' }}>
              Assign unique receipt templates to specific shops, or let them automatically inherit the global platform default.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '12px',
              color: '#E2E8F0',
            }}
          >
            <span style={{ color: '#94A3B8' }}>Platform Default: </span>
            <strong style={{ color: '#D4AF37' }}>{defaultTemplate?.name || 'Standard 80mm'}</strong>
          </div>
          <button
            onClick={fetchAssignments}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <input
          type="text"
          placeholder="Filter branches by name or slug..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            maxWidth: '380px',
            width: '100%',
            background: 'rgba(20, 20, 20, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: '#FFFFFF',
            outline: 'none',
          }}
        />
        <div style={{ fontSize: '12px', color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>
          Total Branches: <strong>{assignments.length}</strong>
        </div>
      </div>

      {/* Assignment Table */}
      <div
        style={{
          background: '#0D0D0D',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.02)',
                color: '#94A3B8',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <th style={{ padding: '14px 20px' }}>Branch / Shop</th>
              <th style={{ padding: '14px 20px' }}>Facility Type</th>
              <th style={{ padding: '14px 20px' }}>Current Print Layout</th>
              <th style={{ padding: '14px 20px' }}>Status</th>
              <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                  {loading ? 'Loading branch layout records...' : 'No branches found.'}
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const isCustom = Boolean(a.template_id);
                const assignedTmpl = templates.find((t) => t.id === a.template_id);
                const activeTmpl = assignedTmpl || defaultTemplate;

                return (
                  <tr
                    key={a.tenant_id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#D4AF37',
                          }}
                        >
                          <Store style={{ width: 16, height: 16 }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{a.tenant_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                            /{a.tenant_slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background:
                            a.tenant_type === 'factory'
                              ? 'rgba(168, 85, 247, 0.15)'
                              : a.tenant_type === 'godown'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(34, 197, 94, 0.15)',
                          color:
                            a.tenant_type === 'factory'
                              ? '#C084FC'
                              : a.tenant_type === 'godown'
                              ? '#60A5FA'
                              : '#4ADE80',
                        }}
                      >
                        {a.tenant_type}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <select
                          disabled={savingTenantId === a.tenant_id}
                          value={a.template_id || '__default__'}
                          onChange={(e) => handleAssign(a.tenant_id, e.target.value)}
                          style={{
                            background: '#1A1A1A',
                            color: '#FFFFFF',
                            border: isCustom
                              ? '1px solid rgba(212, 175, 55, 0.6)'
                              : '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          <option value="__default__">
                            ⚡ Platform Default ({defaultTemplate ? defaultTemplate.name : 'Standard'})
                          </option>
                          <optgroup label="Specific Templates">
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.paper_size})
                              </option>
                            ))}
                          </optgroup>
                        </select>

                        {isCustom ? (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(212, 175, 55, 0.2)',
                              color: '#D4AF37',
                              fontWeight: 700,
                              border: '1px solid rgba(212, 175, 55, 0.4)',
                            }}
                          >
                            CUSTOM OVERRIDE
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: '#94A3B8',
                            }}
                          >
                            INHERITED
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          color: a.is_active ? '#34D399' : '#EF4444',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '9999px',
                            background: a.is_active ? '#34D399' : '#EF4444',
                          }}
                        />
                        {a.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      {activeTmpl && (
                        <button
                          onClick={() => onPreviewTemplate(activeTmpl, a.tenant_name)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Printer style={{ width: 13, height: 13, color: '#D4AF37' }} />
                          Preview
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
