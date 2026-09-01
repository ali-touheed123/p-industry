'use client';

import React, { useState } from 'react';
import { Tenant } from '@/types';
import { Settings, ShieldCheck, Users, Percent, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface SettingsViewProps {
  tenant?: Tenant | null;
  onTenantUpdated?: (updated: Tenant) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ tenant, onTenantUpdated }) => {
  const [commissionEnabled, setCommissionEnabled] = useState<boolean>(
    tenant?.commission_enabled ?? false
  );
  const [commissionRate, setCommissionRate] = useState<number>(
    tenant?.commission_rate ?? 2.0
  );
  const [splitLead, setSplitLead] = useState<number>(
    tenant?.commission_split_lead ?? 35.0
  );
  const [splitStaff, setSplitStaff] = useState<number>(
    tenant?.commission_split_staff ?? 35.0
  );
  const [splitReserve, setSplitReserve] = useState<number>(
    tenant?.commission_split_reserve ?? 30.0
  );

  const [name, setName] = useState(tenant?.name || '');
  const [phone, setPhone] = useState(tenant?.phone || '');
  const [city, setCity] = useState(tenant?.city || '');
  const [address, setAddress] = useState(tenant?.address || '');

  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto calculate total split percent
  const totalSplitPercent = splitLead + splitStaff + splitReserve;
  const isSplitBalanced = Math.round(totalSplitPercent) === 100;

  // Example simulation calculation (on Rs. 100,000 sales)
  const sampleSales = 100000;
  const samplePool = Math.round(sampleSales * (commissionRate / 100));
  const sampleLead = Math.round(samplePool * (splitLead / 100));
  const sampleStaff = Math.round(samplePool * (splitStaff / 100));
  const sampleReserve = Math.round(samplePool * (splitReserve / 100));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tenant.id,
          name,
          phone,
          city,
          address,
          commission_enabled: commissionEnabled,
          commission_rate: commissionRate,
          commission_split_lead: splitLead,
          commission_split_staff: splitStaff,
          commission_split_reserve: splitReserve,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: 'Branch configuration & commission rules saved successfully!',
        });
        if (onTenantUpdated) {
          onTenantUpdated({
            ...tenant,
            name,
            phone,
            city,
            address,
            commission_enabled: commissionEnabled,
            commission_rate: commissionRate,
            commission_split_lead: splitLead,
            commission_split_staff: splitStaff,
            commission_split_reserve: splitReserve,
          });
        }
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to save settings' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '900px', margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="ceo-font-heading" style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Branch Rules &amp; Commission Settings
          </h2>
          <p className="ceo-font-sans" style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
            Configure staff sales incentives, commission pools, and branch parameters.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: feedback.type === 'success' ? '#064E3B' : '#7F1D1D',
            color: '#FFFFFF',
            fontSize: '12.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: `1px solid ${feedback.type === 'success' ? '#059669' : '#DC2626'}`,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 style={{ width: 16, height: 16 }} /> : <AlertCircle style={{ width: 16, height: 16 }} />}
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* ── CARD 1: Staff Commission Control ── */}
        <div className="ceo-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(198, 161, 91, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                <Percent style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <div className="ceo-font-heading" style={{ fontSize: '15px', fontWeight: 700, color: '#F3F4F6' }}>
                  Staff Sales Commission System
                </div>
                <div style={{ fontSize: '11.5px', color: '#9CA3AF' }}>
                  Enable or disable commission calculation on Daily Shift Close.
                </div>
              </div>
            </div>

            {/* Toggle Switch */}
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
              <input
                type="checkbox"
                checked={commissionEnabled}
                onChange={e => setCommissionEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#D97706', cursor: 'pointer' }}
              />
              <span className="ceo-font-mono" style={{ fontSize: '12px', fontWeight: 700, color: commissionEnabled ? '#34D399' : '#9CA3AF' }}>
                {commissionEnabled ? 'ENABLED (ACTIVE)' : 'DISABLED (OFF)'}
              </span>
            </label>
          </div>

          {commissionEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0' }}>
              {/* Pool Rate Setting */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <label className="ceo-font-mono" style={{ fontSize: '11px', color: '#D97706', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Sales Commission Rate (%)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#11141A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 10px', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      required
                      value={commissionRate}
                      onChange={e => setCommissionRate(parseFloat(e.target.value) || 0)}
                      style={{ background: 'transparent', border: 'none', color: '#F3F4F6', fontSize: '15px', fontWeight: 700, width: '100%', outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                    <span style={{ color: '#9CA3AF', fontWeight: 700 }}>%</span>
                  </div>
                </div>

                <div style={{ fontSize: '11.5px', color: '#9CA3AF', lineHeight: 1.4 }}>
                  💡 <strong>How it works:</strong> Every day on shift close, <strong>{commissionRate}%</strong> of total net sales will be allocated into the staff commission pool.
                </div>
              </div>

              {/* Staff Split Allocation */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="ceo-font-mono" style={{ fontSize: '11px', color: '#D97706', textTransform: 'uppercase', fontWeight: 700 }}>
                    Commission Pool Distribution (% of Pool)
                  </label>
                  <span
                    className="ceo-font-mono"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isSplitBalanced ? '#34D399' : '#EF4444',
                    }}
                  >
                    Total: {totalSplitPercent}% {isSplitBalanced ? '✓ Balanced' : '⚠️ Must equal 100%'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
                  {/* Lead Staff Share */}
                  <div style={{ background: '#11141A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>Lead Staff / Cashier</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        required
                        value={splitLead}
                        onChange={e => setSplitLead(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: '#F3F4F6', fontSize: '14px', fontWeight: 700, outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
                      />
                      <span style={{ color: '#9CA3AF', fontSize: '12px' }}>%</span>
                    </div>
                  </div>

                  {/* Floor Staff Share */}
                  <div style={{ background: '#11141A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>Floor Staff / Junior</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        required
                        value={splitStaff}
                        onChange={e => setSplitStaff(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: '#F3F4F6', fontSize: '14px', fontWeight: 700, outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
                      />
                      <span style={{ color: '#9CA3AF', fontSize: '12px' }}>%</span>
                    </div>
                  </div>

                  {/* Shop Reserve / Retained */}
                  <div style={{ background: '#11141A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>Shop Reserve / Bonus</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        required
                        value={splitReserve}
                        onChange={e => setSplitReserve(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: '#F3F4F6', fontSize: '14px', fontWeight: 700, outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
                      />
                      <span style={{ color: '#9CA3AF', fontSize: '12px' }}>%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px dashed #3B82F6', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#60A5FA', marginBottom: '4px' }}>
                  <Sparkles style={{ width: 14, height: 14 }} />
                  Live Calculation Example (on Rs. 100,000 Net Sales):
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span>Pool ({commissionRate}%): <strong style={{ color: '#F3F4F6' }}>Rs. {samplePool.toLocaleString()}</strong></span>
                  <span>Lead Staff ({splitLead}%): <strong style={{ color: '#34D399' }}>Rs. {sampleLead.toLocaleString()}</strong></span>
                  <span>Floor Staff ({splitStaff}%): <strong style={{ color: '#34D399' }}>Rs. {sampleStaff.toLocaleString()}</strong></span>
                  <span>Shop Reserve ({splitReserve}%): <strong style={{ color: '#9CA3AF' }}>Rs. {sampleReserve.toLocaleString()}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── CARD 2: Branch Info ── */}
        <div className="ceo-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="ceo-font-heading" style={{ fontSize: '15px', fontWeight: 700, color: '#F3F4F6' }}>
            Branch Contact &amp; Details
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="ceo-font-mono" style={{ fontSize: '10.5px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Shop / Branch Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', background: '#11141A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', color: '#F3F4F6', fontSize: '13px', outline: 'none' }}
              />
            </div>

            <div>
              <label className="ceo-font-mono" style={{ fontSize: '10.5px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Phone / WhatsApp (For Day Close Alerts)
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                style={{ width: '100%', background: '#11141A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', color: '#F3F4F6', fontSize: '13px', outline: 'none' }}
              />
            </div>

            <div>
              <label className="ceo-font-mono" style={{ fontSize: '10.5px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Karachi / Lahore / Rawalpindi"
                style={{ width: '100%', background: '#11141A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', color: '#F3F4F6', fontSize: '13px', outline: 'none' }}
              />
            </div>

            <div>
              <label className="ceo-font-mono" style={{ fontSize: '10.5px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Main Market, Shop # 4"
                style={{ width: '100%', background: '#11141A', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', color: '#F3F4F6', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving || (commissionEnabled && !isSplitBalanced)}
          style={{
            padding: '12px 24px',
            background: saving ? '#4B5563' : '#D97706',
            color: '#0D1117',
            fontWeight: 800,
            fontSize: '13px',
            borderRadius: '8px',
            border: 'none',
            cursor: saving ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {saving ? 'Saving Changes...' : '💾 Save Branch & Commission Settings'}
        </button>
      </form>
    </div>
  );
};
