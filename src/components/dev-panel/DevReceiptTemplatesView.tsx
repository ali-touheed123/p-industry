import React, { useState, useEffect } from 'react';
import {
  Printer,
  Plus,
  Copy,
  Trash2,
  Check,
  Star,
  Sliders,
  Eye,
  ArrowLeft,
  Save,
  RotateCcw,
  Sparkles,
  Layers,
  FileText,
  Lock,
  Unlock,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  ReceiptTemplate,
  TemplateJson,
  PaperSize,
  PAPER_SIZE_CONFIG,
  DEFAULT_TEMPLATE_JSON,
  TableColumnId,
} from '@/types/receipt';
import { DevReceiptPreview, MOCK_INVOICE_DATA } from './DevReceiptPreview';
import { DevTemplateAssignView } from './DevTemplateAssignView';

interface DevReceiptTemplatesViewProps {
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

type DesignerTab = 'layout' | 'header' | 'meta' | 'table' | 'totals' | 'footer' | 'locks';

export const DevReceiptTemplatesView: React.FC<DevReceiptTemplatesViewProps> = ({ onShowToast }) => {
  const [activeMainTab, setActiveMainTab] = useState<'templates' | 'branches'>('templates');
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Designer State
  const [isDesigning, setIsDesigning] = useState<boolean>(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string>('New Receipt Template');
  const [templateDesc, setTemplateDesc] = useState<string>('');
  const [paperSize, setPaperSize] = useState<PaperSize>('thermal_80');
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [templateJson, setTemplateJson] = useState<TemplateJson>(JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_JSON)));
  const [activeDesignerTab, setActiveDesignerTab] = useState<DesignerTab>('layout');
  const [saving, setSaving] = useState<boolean>(false);

  // Preview options
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [previewShopName, setPreviewShopName] = useState<string>('');

  // Fetch all templates
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/receipt-templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      } else {
        onShowToast(data.error || 'Failed to load templates', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Error fetching templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Open Designer for New Template
  const handleCreateNew = () => {
    setEditingTemplateId(null);
    setTemplateName('Thermal 80mm Custom Design');
    setTemplateDesc('Tailored receipt format for retail checkout.');
    setPaperSize('thermal_80');
    setIsDefault(false);
    setTemplateJson(JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_JSON)));
    setActiveDesignerTab('layout');
    setIsDesigning(true);
  };

  // Open Designer for Existing Template
  const handleEdit = (tmpl: ReceiptTemplate) => {
    setEditingTemplateId(tmpl.id);
    setTemplateName(tmpl.name);
    setTemplateDesc(tmpl.description || '');
    setPaperSize(tmpl.paper_size);
    setIsDefault(tmpl.is_default);
    setTemplateJson(JSON.parse(JSON.stringify(tmpl.template_json || DEFAULT_TEMPLATE_JSON)));
    setActiveDesignerTab('layout');
    setIsDesigning(true);
  };

  // Clone Template
  const handleClone = async (tmpl: ReceiptTemplate) => {
    try {
      const clonedJson = JSON.parse(JSON.stringify(tmpl.template_json || DEFAULT_TEMPLATE_JSON));
      const res = await fetch('/api/receipt-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${tmpl.name} (Copy)`,
          description: tmpl.description ? `Copy of ${tmpl.description}` : 'Cloned receipt layout',
          paper_size: tmpl.paper_size,
          template_json: clonedJson,
          is_default: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast('Template duplicated successfully!');
        fetchTemplates();
      } else {
        onShowToast(data.error || 'Failed to duplicate template', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Clone failed', 'error');
    }
  };

  // Set as platform default
  const handleSetDefault = async (tmpl: ReceiptTemplate) => {
    try {
      const res = await fetch('/api/receipt-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tmpl.id, is_default: true }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast(`"${tmpl.name}" is now the platform default template!`);
        fetchTemplates();
      } else {
        onShowToast(data.error || 'Failed to update default', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Error updating default', 'error');
    }
  };

  // Delete Template
  const handleDelete = async (tmpl: ReceiptTemplate) => {
    if (tmpl.is_default && templates.filter((t) => !t.is_deleted).length > 1) {
      if (!confirm(`"${tmpl.name}" is the platform default template. Are you sure you want to delete it? Another template will need to be marked as default.`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete "${tmpl.name}"?`)) return;
    }

    try {
      const res = await fetch(`/api/receipt-templates?id=${tmpl.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        onShowToast('Template deleted successfully.');
        fetchTemplates();
      } else {
        onShowToast(data.error || 'Failed to delete template', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Delete failed', 'error');
    }
  };

  // Save Template in Designer
  const handleSave = async () => {
    if (!templateName.trim()) {
      onShowToast('Please provide a template name', 'error');
      return;
    }

    try {
      setSaving(true);
      const isEditing = Boolean(editingTemplateId);
      const endpoint = '/api/receipt-templates';
      const method = isEditing ? 'PATCH' : 'POST';

      const payload = {
        id: editingTemplateId,
        name: templateName.trim(),
        description: templateDesc.trim() || null,
        paper_size: paperSize,
        template_json: templateJson,
        is_default: isDefault,
      };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        onShowToast(isEditing ? 'Receipt template updated!' : 'New receipt template created!');
        setIsDesigning(false);
        fetchTemplates();
      } else {
        onShowToast(data.error || 'Failed to save template', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Error saving template', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Test Print
  const handleTestPrint = () => {
    const printArea = document.getElementById('designer-preview-receipt');
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      window.print();
      return;
    }

    const sizeConfig = PAPER_SIZE_CONFIG[paperSize];
    const isThermal = paperSize.startsWith('thermal');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt Test Print - ${templateName}</title>
          <style>
            @page {
              size: ${isThermal ? `${sizeConfig.widthMm}mm auto` : paperSize === 'a5' ? 'A5' : 'A4'};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .receipt-preview-container {
              box-shadow: none !important;
              margin: 0 auto !important;
            }
          </style>
        </head>
        <body>
          ${printArea.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Helper to toggle table columns
  const toggleColumn = (col: TableColumnId) => {
    const current = [...templateJson.itemsTable.columns];
    const idx = current.indexOf(col);
    if (idx >= 0) {
      if (current.length === 1) {
        onShowToast('At least one column must be visible', 'error');
        return;
      }
      current.splice(idx, 1);
    } else {
      current.push(col);
    }
    setTemplateJson({
      ...templateJson,
      itemsTable: { ...templateJson.itemsTable, columns: current },
    });
  };

  // Helper to toggle locks
  const toggleLock = (key: string) => {
    const locks = { ...templateJson.locks };
    locks[key] = !locks[key];
    setTemplateJson({ ...templateJson, locks });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ─── TOP CONTROL HEADER ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25) 0%, rgba(212, 175, 55, 0.05) 100%)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF37',
              }}
            >
              <Printer style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>
                Receipt Template Builder
              </h1>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0' }}>
                No-code thermal &amp; A4 receipt customizer with live real-time simulation &amp; branch overrides
              </p>
            </div>
          </div>
        </div>

        {/* Tab switch & Add button (when not designing) */}
        {!isDesigning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '3px',
              }}
            >
              <button
                onClick={() => setActiveMainTab('templates')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeMainTab === 'templates' ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                  color: activeMainTab === 'templates' ? '#F3E5AB' : '#94A3B8',
                  borderBottom: activeMainTab === 'templates' ? '1px solid #D4AF37' : 'none',
                }}
              >
                📐 Templates Library
              </button>
              <button
                onClick={() => setActiveMainTab('branches')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeMainTab === 'branches' ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                  color: activeMainTab === 'branches' ? '#F3E5AB' : '#94A3B8',
                  borderBottom: activeMainTab === 'branches' ? '1px solid #D4AF37' : 'none',
                }}
              >
                🏢 Branch Assignments
              </button>
            </div>

            <button
              onClick={handleCreateNew}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #D4AF37 0%, #AA820A 100%)',
                color: '#000000',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(212, 175, 55, 0.3)',
              }}
            >
              <Plus style={{ width: 16, height: 16 }} />
              Create Template
            </button>
          </div>
        )}
      </div>

      {/* ─── VIEW 1: BRANCH ASSIGNMENTS ────────────────────────────── */}
      {!isDesigning && activeMainTab === 'branches' && (
        <DevTemplateAssignView
          templates={templates}
          onShowToast={onShowToast}
          onPreviewTemplate={(tmpl, tenantName) => {
            handleEdit(tmpl);
            if (tenantName) setPreviewShopName(tenantName);
          }}
        />
      )}

      {/* ─── VIEW 2: TEMPLATE LIST ─────────────────────────────────── */}
      {!isDesigning && activeMainTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
              Loading receipt templates...
            </div>
          ) : templates.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: '#0D0D0D',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: '16px',
              }}
            >
              <Printer style={{ width: 48, height: 48, color: '#D4AF37', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFF' }}>No receipt templates yet</h3>
              <p style={{ fontSize: '13px', color: '#94A3B8', maxWidth: '400px', margin: '8px auto 16px' }}>
                Create your first print layout or seed the standard thermal 80mm format.
              </p>
              <button
                onClick={handleCreateNew}
                style={{
                  padding: '9px 18px',
                  background: '#D4AF37',
                  color: '#000',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Create Template
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '16px',
              }}
            >
              {templates.map((tmpl) => {
                const sizeConf = PAPER_SIZE_CONFIG[tmpl.paper_size] || PAPER_SIZE_CONFIG.thermal_80;
                return (
                  <div
                    key={tmpl.id}
                    style={{
                      background: '#0D0D0D',
                      border: tmpl.is_default
                        ? '1px solid rgba(212, 175, 55, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px',
                      boxShadow: tmpl.is_default ? '0 4px 20px rgba(212, 175, 55, 0.08)' : 'none',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                            {tmpl.name}
                          </h3>
                          <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0' }}>
                            {tmpl.description || 'Custom print template'}
                          </p>
                        </div>
                        {tmpl.is_default && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px',
                              fontWeight: 800,
                              fontFamily: "'JetBrains Mono', monospace",
                              textTransform: 'uppercase',
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              background: 'rgba(212, 175, 55, 0.2)',
                              color: '#D4AF37',
                              border: '1px solid rgba(212, 175, 55, 0.4)',
                            }}
                          >
                            <Star style={{ width: 10, height: 10, fill: '#D4AF37' }} />
                            PLATFORM DEFAULT
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: "'JetBrains Mono', monospace",
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: '#E2E8F0',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          📄 {sizeConf.label} ({sizeConf.widthMm}mm)
                        </span>

                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: "'JetBrains Mono', monospace",
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: '#E2E8F0',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          Font: {tmpl.template_json?.layout?.fontFamily || 'mono'} ({tmpl.template_json?.layout?.fontSize || 12}px)
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '14px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleEdit(tmpl)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 12px',
                            background: 'rgba(212, 175, 55, 0.15)',
                            border: '1px solid rgba(212, 175, 55, 0.3)',
                            borderRadius: '8px',
                            color: '#F3E5AB',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Sliders style={{ width: 13, height: 13 }} />
                          Edit Designer
                        </button>
                        <button
                          onClick={() => handleClone(tmpl)}
                          title="Duplicate Template"
                          style={{
                            padding: '7px 10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#94A3B8',
                            cursor: 'pointer',
                          }}
                        >
                          <Copy style={{ width: 13, height: 13 }} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!tmpl.is_default && (
                          <button
                            onClick={() => handleSetDefault(tmpl)}
                            title="Set as Platform Default"
                            style={{
                              padding: '7px 10px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              color: '#94A3B8',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(tmpl)}
                          title="Delete Template"
                          style={{
                            padding: '7px 10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '8px',
                            color: '#EF4444',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── VIEW 3: FULL SCREEN INTERACTIVE DESIGNER ───────────────── */}
      {isDesigning && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Designer Action Bar */}
          <div
            style={{
              background: '#0D0D0D',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '14px',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '300px' }}>
              <button
                onClick={() => setIsDesigning(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft style={{ width: 14, height: 14 }} />
                Back
              </button>

              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template Name (e.g. Standard Thermal 80mm)"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(212, 175, 55, 0.4)',
                    color: '#FFFFFF',
                    fontSize: '16px',
                    fontWeight: 700,
                    width: '100%',
                    padding: '4px 0',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#E2E8F0',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  style={{ accentColor: '#D4AF37', cursor: 'pointer' }}
                />
                Platform Default
              </label>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 20px',
                  background: 'linear-gradient(135deg, #D4AF37 0%, #AA820A 100%)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(212, 175, 55, 0.25)',
                }}
              >
                <Save style={{ width: 14, height: 14 }} />
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>

          {/* Designer Main Split View */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '20px',
              alignItems: 'start',
            }}
          >
            {/* ─── LEFT: CONTROLS & SETTINGS ─── */}
            <div
              style={{
                background: '#0D0D0D',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
            >
              {/* Settings Sub-tabs */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  overflowX: 'auto',
                }}
              >
                {(
                  [
                    { id: 'layout', label: 'Paper & Page' },
                    { id: 'header', label: 'Header & Logo' },
                    { id: 'meta', label: 'Invoice Meta' },
                    { id: 'table', label: 'Items Table' },
                    { id: 'totals', label: 'Totals & Tax' },
                    { id: 'footer', label: 'Footer & Notes' },
                    { id: 'locks', label: '🔒 Field Locks' },
                  ] as { id: DesignerTab; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDesignerTab(tab.id)}
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: 'none',
                      borderBottom: activeDesignerTab === tab.id ? '2px solid #D4AF37' : '2px solid transparent',
                      background: activeDesignerTab === tab.id ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                      color: activeDesignerTab === tab.id ? '#F3E5AB' : '#94A3B8',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab Content Area */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* 1. PAPER & LAYOUT */}
                {activeDesignerTab === 'layout' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', display: 'block', marginBottom: '8px' }}>
                        Paper Format / Target Printer
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {(['thermal_80', 'thermal_58', 'a4', 'a5'] as PaperSize[]).map((ps) => {
                          const conf = PAPER_SIZE_CONFIG[ps];
                          const selected = paperSize === ps;
                          return (
                            <button
                              key={ps}
                              onClick={() => setPaperSize(ps)}
                              style={{
                                padding: '12px',
                                borderRadius: '10px',
                                border: selected ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                                background: selected ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                color: selected ? '#F3E5AB' : '#E2E8F0',
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontSize: '13px', fontWeight: 700 }}>{conf.label}</div>
                              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                                Width: {conf.widthMm}mm
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                          Base Font Size: {templateJson.layout.fontSize}px
                        </label>
                        <input
                          type="range"
                          min="9"
                          max="18"
                          value={templateJson.layout.fontSize}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              layout: { ...templateJson.layout, fontSize: Number(e.target.value) },
                            })
                          }
                          style={{ width: '100%', accentColor: '#D4AF37' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                          Font Family Style
                        </label>
                        <select
                          value={templateJson.layout.fontFamily}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              layout: { ...templateJson.layout, fontFamily: e.target.value as any },
                            })
                          }
                          style={{
                            width: '100%',
                            background: '#1A1A1A',
                            color: '#FFFFFF',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            padding: '7px 10px',
                            fontSize: '12px',
                          }}
                        >
                          <option value="mono">JetBrains Mono (Thermal Standard)</option>
                          <option value="sans">Modern Sans-Serif</option>
                          <option value="serif">Classic Serif</option>
                        </select>
                      </div>
                    </div>

                    {/* Margins */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', display: 'block', marginBottom: '8px' }}>
                        Page Margins (in millimeters)
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {[
                          { key: 'marginTop', label: 'Top' },
                          { key: 'marginBottom', label: 'Bottom' },
                          { key: 'marginLeft', label: 'Left' },
                          { key: 'marginRight', label: 'Right' },
                        ].map((m) => (
                          <div key={m.key}>
                            <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '3px' }}>
                              {m.label}: {(templateJson.layout as any)[m.key]}mm
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="30"
                              value={(templateJson.layout as any)[m.key]}
                              onChange={(e) =>
                                setTemplateJson({
                                  ...templateJson,
                                  layout: {
                                    ...templateJson.layout,
                                    [m.key]: Math.max(0, Number(e.target.value)),
                                  },
                                })
                              }
                              style={{
                                width: '100%',
                                background: '#1A1A1A',
                                color: '#FFF',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '6px',
                                padding: '6px',
                                fontSize: '12px',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. HEADER & LOGO */}
                {activeDesignerTab === 'header' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.header.showLogo}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              header: { ...templateJson.header, showLogo: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Display Brand Logo
                      </label>
                    </div>

                    {templateJson.header.showLogo && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                            Logo Height: {templateJson.header.logoSize}px
                          </label>
                          <input
                            type="range"
                            min="24"
                            max="96"
                            value={templateJson.header.logoSize}
                            onChange={(e) =>
                              setTemplateJson({
                                ...templateJson,
                                header: { ...templateJson.header, logoSize: Number(e.target.value) },
                              })
                            }
                            style={{ width: '100%', accentColor: '#D4AF37' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                            Header Alignment
                          </label>
                          <select
                            value={templateJson.header.align}
                            onChange={(e) =>
                              setTemplateJson({
                                ...templateJson,
                                header: { ...templateJson.header, align: e.target.value as any },
                              })
                            }
                            style={{ width: '100%', background: '#1A1A1A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '6px', fontSize: '12px' }}
                          >
                            <option value="center">Center</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.header.showShopName}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              header: { ...templateJson.header, showShopName: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Display Shop / Business Name
                      </label>

                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.header.showAddress}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              header: { ...templateJson.header, showAddress: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Display Physical Address
                      </label>

                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.header.showPhone}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              header: { ...templateJson.header, showPhone: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Display Phone Number
                      </label>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                        Header Divider Style
                      </label>
                      <select
                        value={templateJson.header.separator}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            header: { ...templateJson.header, separator: e.target.value as any },
                          })
                        }
                        style={{ width: '100%', background: '#1A1A1A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '7px 10px', fontSize: '12px' }}
                      >
                        <option value="dashed">Dashed Line (-----------------)</option>
                        <option value="solid">Solid Line (━━━━━━━━━━━━━)</option>
                        <option value="double">Double Line (═════════════)</option>
                        <option value="none">None (Clean whitespace)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 3. INVOICE META */}
                {activeDesignerTab === 'meta' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={templateJson.invoiceInfo.showInvoiceNo}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              invoiceInfo: { ...templateJson.invoiceInfo, showInvoiceNo: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Show Invoice Number
                      </label>
                      <input
                        type="text"
                        value={templateJson.invoiceInfo.invoiceLabel}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            invoiceInfo: { ...templateJson.invoiceInfo, invoiceLabel: e.target.value },
                          })
                        }
                        placeholder="Label (e.g. Invoice # / Bill No)"
                        style={{ background: '#1A1A1A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', width: '140px' }}
                      />
                    </div>

                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.invoiceInfo.showDate}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            invoiceInfo: { ...templateJson.invoiceInfo, showDate: e.target.checked },
                          })
                        }
                        style={{ accentColor: '#D4AF37' }}
                      />
                      Show Date &amp; Timestamp
                    </label>

                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.invoiceInfo.showCashier}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            invoiceInfo: { ...templateJson.invoiceInfo, showCashier: e.target.checked },
                          })
                        }
                        style={{ accentColor: '#D4AF37' }}
                      />
                      Show Cashier / Counter Name
                    </label>

                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.invoiceInfo.showCustomer}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            invoiceInfo: { ...templateJson.invoiceInfo, showCustomer: e.target.checked },
                          })
                        }
                        style={{ accentColor: '#D4AF37' }}
                      />
                      Show Customer / Client Name
                    </label>

                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.invoiceInfo.showPaymentMethod}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            invoiceInfo: { ...templateJson.invoiceInfo, showPaymentMethod: e.target.checked },
                          })
                        }
                        style={{ accentColor: '#D4AF37' }}
                      />
                      Show Payment Method (Cash, Credit, Bank)
                    </label>
                  </div>
                )}

                {/* 4. ITEMS TABLE */}
                {activeDesignerTab === 'table' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', display: 'block', marginBottom: '8px' }}>
                        Visible Columns
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {(
                          [
                            { id: 'name', label: 'Item Name' },
                            { id: 'code', label: 'Code / SKU' },
                            { id: 'qty', label: 'Quantity' },
                            { id: 'rate', label: 'Unit Rate' },
                            { id: 'discount', label: 'Discount' },
                            { id: 'amount', label: 'Total Amount' },
                          ] as { id: TableColumnId; label: string }[]
                        ).map((col) => {
                          const active = templateJson.itemsTable.columns.includes(col.id);
                          return (
                            <button
                              key={col.id}
                              onClick={() => toggleColumn(col.id)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: active ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                                background: active ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255,255,255,0.02)',
                                color: active ? '#F3E5AB' : '#94A3B8',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {active ? '✓ ' : '+ '}
                              {col.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                          Row Padding: {templateJson.itemsTable.rowPadding}px
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="8"
                          value={templateJson.itemsTable.rowPadding}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              itemsTable: { ...templateJson.itemsTable, rowPadding: Number(e.target.value) },
                            })
                          }
                          style={{ width: '100%', accentColor: '#D4AF37' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                          Table Font Size: {templateJson.itemsTable.fontSize}px
                        </label>
                        <input
                          type="range"
                          min="9"
                          max="16"
                          value={templateJson.itemsTable.fontSize}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              itemsTable: { ...templateJson.itemsTable, fontSize: Number(e.target.value) },
                            })
                          }
                          style={{ width: '100%', accentColor: '#D4AF37' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.itemsTable.showBorders}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              itemsTable: { ...templateJson.itemsTable, showBorders: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Show Table Borders
                      </label>

                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.itemsTable.compact}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              itemsTable: { ...templateJson.itemsTable, compact: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Ultra Compact (No row lines)
                      </label>
                    </div>
                  </div>
                )}

                {/* 5. TOTALS & TAX */}
                {activeDesignerTab === 'totals' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Currency Symbol:</span>
                      <input
                        type="text"
                        value={templateJson.totals.currencySymbol}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            totals: { ...templateJson.totals, currencySymbol: e.target.value },
                          })
                        }
                        style={{ width: '80px', background: '#1A1A1A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px' }}
                      />
                    </div>

                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.totals.showSubtotal}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            totals: { ...templateJson.totals, showSubtotal: e.target.checked },
                          })
                        }
                        style={{ accentColor: '#D4AF37' }}
                      />
                      Show Subtotal
                    </label>

                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.totals.showDiscount}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            totals: { ...templateJson.totals, showDiscount: e.target.checked },
                          })
                        }
                        style={{ accentColor: '#D4AF37' }}
                      />
                      Show Discount Amount
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.totals.showGst}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              totals: { ...templateJson.totals, showGst: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Calculate GST / Sales Tax
                      </label>
                      {templateJson.totals.showGst && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={templateJson.totals.gstRate || 0}
                            onChange={(e) =>
                              setTemplateJson({
                                ...templateJson,
                                totals: { ...templateJson.totals, gstRate: Number(e.target.value) },
                              })
                            }
                            style={{ width: '60px', background: '#1A1A1A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px', fontSize: '12px' }}
                          />
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>%</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.totals.showGrandTotal}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              totals: { ...templateJson.totals, showGrandTotal: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Show Grand Total
                      </label>

                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.totals.boldTotal}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              totals: { ...templateJson.totals, boldTotal: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Extra Bold Total
                      </label>
                    </div>

                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.totals.showPaid}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            totals: { ...templateJson.totals, showPaid: e.target.checked },
                          })
                        }
                        style={{ accentColor: '#D4AF37' }}
                      />
                      Show Paid Amount
                    </label>

                    <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.totals.showBalance}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              totals: { ...templateJson.totals, showBalance: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Show Balance Due
                      </label>

                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.totals.highlightBalanceDue}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              totals: { ...templateJson.totals, highlightBalanceDue: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Highlight Balance Due in Red
                      </label>
                    </div>
                  </div>
                )}

                {/* 6. FOOTER & NOTES */}
                {activeDesignerTab === 'footer' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                        Return Policy / Note Line 1
                      </label>
                      <input
                        type="text"
                        value={templateJson.footer.line1}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            footer: { ...templateJson.footer, line1: e.target.value },
                          })
                        }
                        style={{ width: '100%', background: '#1A1A1A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '7px 10px', fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>
                        Return Policy / Note Line 2
                      </label>
                      <input
                        type="text"
                        value={templateJson.footer.line2}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            footer: { ...templateJson.footer, line2: e.target.value },
                          })
                        }
                        style={{ width: '100%', background: '#1A1A1A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '7px 10px', fontSize: '12px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.footer.showWhatsapp}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              footer: { ...templateJson.footer, showWhatsapp: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        WhatsApp Support
                      </label>
                      {templateJson.footer.showWhatsapp && (
                        <input
                          type="text"
                          value={templateJson.footer.whatsappNumber}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              footer: { ...templateJson.footer, whatsappNumber: e.target.value },
                            })
                          }
                          placeholder="+92 300 0000000"
                          style={{ width: '150px', background: '#1A1A1A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px' }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={templateJson.footer.showPoweredBy}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              footer: { ...templateJson.footer, showPoweredBy: e.target.checked },
                            })
                          }
                          style={{ accentColor: '#D4AF37' }}
                        />
                        Show ERP Branding Badge
                      </label>
                      {templateJson.footer.showPoweredBy && (
                        <input
                          type="text"
                          value={templateJson.footer.poweredByText}
                          onChange={(e) =>
                            setTemplateJson({
                              ...templateJson,
                              footer: { ...templateJson.footer, poweredByText: e.target.value },
                            })
                          }
                          placeholder="Powered by Pyntflow ERP"
                          style={{ width: '200px', background: '#1A1A1A', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px' }}
                        />
                      )}
                    </div>

                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={templateJson.footer.showQrCode}
                        onChange={(e) =>
                          setTemplateJson({
                            ...templateJson,
                            footer: { ...templateJson.footer, showQrCode: e.target.checked },
                          })
                        }
                        style={{ accentColor: '#D4AF37' }}
                      />
                      Show Verification QR Code Placeholder
                    </label>
                  </div>
                )}

                {/* 7. FIELD LOCKS */}
                {activeDesignerTab === 'locks' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ padding: '12px', background: 'rgba(212, 175, 55, 0.08)', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#F3E5AB' }}>Developer Governance Locks</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>
                        Locked settings are strictly enforced platform-wide and cannot be altered or bypassed by branch CEOs or cashiers.
                      </div>
                    </div>

                    {[
                      { key: 'powered_by', label: 'Lock "Powered by Pyntflow ERP" Branding' },
                      { key: 'paper_size', label: 'Lock Paper Format & Sizing' },
                      { key: 'gst_rate', label: 'Lock GST Tax Calculation' },
                      { key: 'shop_name', label: 'Lock Store Title Override' },
                      { key: 'whatsapp', label: 'Lock WhatsApp Helpdesk Number' },
                    ].map((item) => {
                      const isLocked = Boolean(templateJson.locks?.[item.key]);
                      return (
                        <div
                          key={item.key}
                          onClick={() => toggleLock(item.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: isLocked ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255,255,255,0.02)',
                            border: isLocked ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: '13px', color: isLocked ? '#F3E5AB' : '#E2E8F0', fontWeight: 600 }}>
                            {item.label}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isLocked ? '#D4AF37' : '#64748B' }}>
                            {isLocked ? <Lock style={{ width: 14, height: 14 }} /> : <Unlock style={{ width: 14, height: 14 }} />}
                            <span style={{ fontSize: '11px', fontWeight: 700 }}>{isLocked ? 'LOCKED' : 'UNLOCKED'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ─── RIGHT: LIVE REAL-TIME PREVIEW ─── */}
            <div
              style={{
                background: '#0D0D0D',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Preview Bar */}
              <div
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye style={{ width: 15, height: 15, color: '#D4AF37' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
                    Live Print Preview
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(52, 211, 153, 0.15)',
                      color: '#34D399',
                      fontWeight: 700,
                    }}
                  >
                    REAL-TIME
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Scale selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94A3B8' }}>
                    <span>Zoom:</span>
                    <button
                      onClick={() => setPreviewScale((s) => Math.max(0.7, Number((s - 0.1).toFixed(1))))}
                      style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer' }}
                    >
                      -
                    </button>
                    <span style={{ minWidth: '32px', textAlign: 'center' }}>{Math.round(previewScale * 100)}%</span>
                    <button
                      onClick={() => setPreviewScale((s) => Math.min(1.4, Number((s + 0.1).toFixed(1))))}
                      style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>

                  {/* Print Button */}
                  <button
                    onClick={handleTestPrint}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'rgba(212, 175, 55, 0.2)',
                      border: '1px solid rgba(212, 175, 55, 0.4)',
                      borderRadius: '8px',
                      color: '#F3E5AB',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Printer style={{ width: 13, height: 13 }} />
                    Test Print
                  </button>
                </div>
              </div>

              {/* Receipt Preview Canvas */}
              <div
                style={{
                  padding: '24px 16px',
                  background: '#141414',
                  minHeight: '520px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  overflowY: 'auto',
                }}
              >
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <DevReceiptPreview
                    id="designer-preview-receipt"
                    template={templateJson}
                    paperSize={paperSize}
                    scale={previewScale}
                    invoiceData={{
                      ...MOCK_INVOICE_DATA,
                      shop_name: previewShopName || MOCK_INVOICE_DATA.shop_name,
                    }}
                  />
                </div>
              </div>

              {/* Status info bar */}
              <div
                style={{
                  padding: '8px 16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: '#64748B',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <span>Format: {PAPER_SIZE_CONFIG[paperSize].label}</span>
                <span>Width: {PAPER_SIZE_CONFIG[paperSize].widthMm}mm</span>
                <span>Margin: {templateJson.layout.marginTop}mm / {templateJson.layout.marginLeft}mm</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
