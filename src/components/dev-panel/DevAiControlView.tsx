'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Zap,
  ShieldAlert,
  SlidersHorizontal,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Activity,
  Layers,
  Edit2,
  Save,
  Check,
} from 'lucide-react';

interface DevAiControlViewProps {
  onShowToast: (message: string, type?: 'success' | 'error') => void;
}

interface GlobalSettings {
  ai_enabled: boolean;
  global_daily_request_cap: number;
  global_monthly_request_cap: number;
  global_monthly_cost_cap: number;
  short_term_rate_limit: number;
  daily_used: number;
  monthly_used: number;
  monthly_cost: number;
  total_tokens_30d: number;
}

interface ShopAiItem {
  tenant_id: string;
  name: string;
  slug: string;
  city?: string;
  is_active: boolean;
  ai_enabled: boolean;
  daily_request_limit: number;
  monthly_request_limit: number;
  daily_used: number;
  monthly_used: number;
  remaining_daily: number;
  remaining_monthly: number;
}

interface LedgerHistoryRow {
  id: string;
  request_id: string;
  tenant_id: string;
  tenant_name: string;
  feature: string;
  provider: string;
  model: string;
  requested_at: string;
  status: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
}

export function DevAiControlView({ onShowToast }: DevAiControlViewProps) {
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);

  const [global, setGlobal] = useState<GlobalSettings | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [shops, setShops] = useState<ShopAiItem[]>([]);
  const [history, setHistory] = useState<LedgerHistoryRow[]>([]);

  // Editing Shop Limits State
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editDailyLimit, setEditDailyLimit] = useState<number>(3);
  const [editMonthlyLimit, setEditMonthlyLimit] = useState<number>(90);

  // Form state for global caps
  const [globalDailyCapInput, setGlobalDailyCapInput] = useState<number>(1000);
  const [globalMonthlyCapInput, setGlobalMonthlyCapInput] = useState<number>(20000);
  const [globalCostCapInput, setGlobalCostCapInput] = useState<number>(50.0);

  const getDevAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('aura_dev_token') : null;
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  };

  const fetchAiControlData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/ai-control', {
        headers: getDevAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setGlobal(data.global);
        setAnalytics(data.analytics);
        setShops(data.shops || []);
        setHistory(data.history || []);

        if (data.global) {
          setGlobalDailyCapInput(data.global.global_daily_request_cap);
          setGlobalMonthlyCapInput(data.global.global_monthly_request_cap);
          setGlobalCostCapInput(data.global.global_monthly_cost_cap);
        }
      } else {
        onShowToast(data.error || 'Failed to load AI Control Center', 'error');
      }
    } catch {
      onShowToast('Network error loading AI Control Center', 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    fetchAiControlData();
  }, [fetchAiControlData]);

  // Toggle Global AI Kill Switch
  const handleToggleGlobalAi = async () => {
    if (!global) return;
    const newStatus = !global.ai_enabled;
    setSavingGlobal(true);
    try {
      const res = await fetch('/api/dev/ai-control', {
        method: 'PATCH',
        headers: getDevAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ target: 'global', ai_enabled: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setGlobal((prev) => (prev ? { ...prev, ai_enabled: newStatus } : null));
        onShowToast(newStatus ? 'Global AI Emergency Switch ENABLED' : 'Global AI Emergency Switch DISABLED (ALL AI BLOCKED)', newStatus ? 'success' : 'error');
      } else {
        onShowToast(data.error || 'Failed to toggle global AI', 'error');
      }
    } catch {
      onShowToast('Failed to toggle global AI', 'error');
    } finally {
      setSavingGlobal(false);
    }
  };

  // Save Global Caps
  const handleSaveGlobalCaps = async () => {
    setSavingGlobal(true);
    try {
      const res = await fetch('/api/dev/ai-control', {
        method: 'PATCH',
        headers: getDevAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          target: 'global',
          global_daily_request_cap: globalDailyCapInput,
          global_monthly_request_cap: globalMonthlyCapInput,
          global_monthly_cost_cap: globalCostCapInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast('Global AI protection caps updated successfully!');
        fetchAiControlData();
      } else {
        onShowToast(data.error || 'Failed to update global caps', 'error');
      }
    } catch {
      onShowToast('Error updating global caps', 'error');
    } finally {
      setSavingGlobal(false);
    }
  };

  // Toggle Shop AI
  const handleToggleShopAi = async (tenantId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/dev/ai-control', {
        method: 'PATCH',
        headers: getDevAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          target: 'shop',
          tenant_id: tenantId,
          ai_enabled: !currentStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast(!currentStatus ? 'Shop AI enabled' : 'Shop AI disabled');
        fetchAiControlData();
      } else {
        onShowToast(data.error || 'Failed to update shop AI', 'error');
      }
    } catch {
      onShowToast('Failed to toggle shop AI', 'error');
    }
  };

  // Save Shop Limits
  const handleSaveShopLimits = async (tenantId: string) => {
    try {
      const res = await fetch('/api/dev/ai-control', {
        method: 'PATCH',
        headers: getDevAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          target: 'shop',
          tenant_id: tenantId,
          daily_request_limit: editDailyLimit,
          monthly_request_limit: editMonthlyLimit,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast('Shop AI limits updated!');
        setEditingShopId(null);
        fetchAiControlData();
      } else {
        onShowToast(data.error || 'Failed to update shop limits', 'error');
      }
    } catch {
      onShowToast('Error updating shop limits', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <RefreshCw className="spin" style={{ width: '20px', height: '20px' }} />
        <span>Loading AI Control Center & Ledger Data...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f9fafb', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot style={{ width: '28px', height: '28px', color: '#a855f7' }} />
            Centralized AI Control Center
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
            Platform-wide Gemini usage controls, tenant quota limits, cost caps & immutable request ledger.
          </p>
        </div>
        <button
          onClick={fetchAiControlData}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#e5e7eb',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          <RefreshCw style={{ width: '15px', height: '15px' }} />
          Refresh Data
        </button>
      </div>

      {/* Global AI Emergency Control & Protection Caps */}
      <div
        style={{
          backgroundColor: '#0d0d12',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: global?.ai_enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: global?.ai_enabled ? '#34d399' : '#f87171',
                  border: `1px solid ${global?.ai_enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}
              >
                {global?.ai_enabled ? <CheckCircle2 style={{ width: '14px', height: '14px' }} /> : <XCircle style={{ width: '14px', height: '14px' }} />}
                AI SERVICES: {global?.ai_enabled ? 'ENABLED' : 'DISABLED'}
              </span>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Global Backend Enforced</span>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', marginTop: '12px', marginBottom: '6px' }}>
              Global AI Emergency Kill Switch & Caps
            </h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, maxWidth: '600px' }}>
              Disabling AI immediately blocks all Gemini requests across every tenant. Protection caps safeguard against platform overconsumption.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={handleToggleGlobalAi}
              disabled={savingGlobal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 24px',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: global?.ai_enabled ? '#ef4444' : '#10b981',
                color: '#ffffff',
                boxShadow: global?.ai_enabled ? '0 8px 20px rgba(239, 68, 68, 0.4)' : '0 8px 20px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              <ShieldAlert style={{ width: '18px', height: '18px' }} />
              {global?.ai_enabled ? 'EMERGENCY KILL SWITCH (TURN OFF)' : 'RE-ENABLE GLOBAL AI'}
            </button>
          </div>
        </div>

        {/* Global Protection Caps Edit Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Global Daily Request Cap
            </label>
            <input
              type="number"
              value={globalDailyCapInput}
              onChange={(e) => setGlobalDailyCapInput(Number(e.target.value))}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
              }}
            />
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              Current 24h: <strong>{global?.daily_used}</strong> / {globalDailyCapInput}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Global 30-Day Request Cap
            </label>
            <input
              type="number"
              value={globalMonthlyCapInput}
              onChange={(e) => setGlobalMonthlyCapInput(Number(e.target.value))}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
              }}
            />
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              Current 30d: <strong>{global?.monthly_used}</strong> / {globalMonthlyCapInput}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Global Monthly Cost Cap ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={globalCostCapInput}
              onChange={(e) => setGlobalCostCapInput(Number(e.target.value))}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
              }}
            />
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              Current 30d Cost: <strong>${global?.monthly_cost?.toFixed(2)}</strong> / ${globalCostCapInput.toFixed(2)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={handleSaveGlobalCaps}
              disabled={savingGlobal}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: '10px',
                backgroundColor: '#8b5cf6',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Save style={{ width: '15px', height: '15px' }} />
              Save Global Caps
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: '#09090b', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#9ca3af', fontSize: '12px' }}>
            <span>Requests Today (24h)</span>
            <Activity style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f3f4f6', marginTop: '8px' }}>
            {analytics?.daily_requests_today || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Rolling 24-hour window</div>
        </div>

        <div style={{ backgroundColor: '#09090b', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#9ca3af', fontSize: '12px' }}>
            <span>30-Day AI Requests</span>
            <Zap style={{ width: '16px', height: '16px', color: '#c084fc' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f3f4f6', marginTop: '8px' }}>
            {analytics?.total_requests_30d || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Rolling 30-day window</div>
        </div>

        <div style={{ backgroundColor: '#09090b', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#9ca3af', fontSize: '12px' }}>
            <span>Total Tokens Processed</span>
            <Layers style={{ width: '16px', height: '16px', color: '#34d399' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f3f4f6', marginTop: '8px' }}>
            {(analytics?.total_tokens_30d || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Input + Candidate tokens</div>
        </div>

        <div style={{ backgroundColor: '#09090b', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#9ca3af', fontSize: '12px' }}>
            <span>Estimated Gemini Cost</span>
            <DollarSign style={{ width: '16px', height: '16px', color: '#facc15' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#facc15', marginTop: '8px' }}>
            ${(analytics?.estimated_cost_30d || 0).toFixed(4)}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Based on Gemini model rates</div>
        </div>
      </div>

      {/* Shop-Level AI Limits & Quotas */}
      <div style={{ backgroundColor: '#09090b', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal style={{ width: '20px', height: '20px', color: '#a855f7' }} />
              Shop-Level AI Limits & Usage
            </h2>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
              Default: <strong>3 req/24h</strong> daily and <strong>90 req/30d</strong> monthly. Limits take effect immediately.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#e5e7eb' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '12px' }}>Shop Name</th>
                <th style={{ padding: '12px' }}>AI Status</th>
                <th style={{ padding: '12px' }}>Daily Limit</th>
                <th style={{ padding: '12px' }}>Monthly Limit</th>
                <th style={{ padding: '12px' }}>24h Usage</th>
                <th style={{ padding: '12px' }}>30d Usage</th>
                <th style={{ padding: '12px' }}>Remaining Scans</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const isEditing = editingShopId === shop.tenant_id;
                return (
                  <tr key={shop.tenant_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '14px 12px', fontWeight: 600 }}>
                      <div>{shop.name}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{shop.city || shop.slug}</div>
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: shop.ai_enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: shop.ai_enabled ? '#34d399' : '#f87171',
                        }}
                      >
                        {shop.ai_enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </td>

                    {/* Daily Limit */}
                    <td style={{ padding: '14px 12px' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editDailyLimit}
                          onChange={(e) => setEditDailyLimit(Number(e.target.value))}
                          style={{
                            width: '70px',
                            padding: '6px',
                            borderRadius: '6px',
                            backgroundColor: '#18181b',
                            border: '1px solid #a855f7',
                            color: '#ffffff',
                            fontWeight: 700,
                          }}
                        />
                      ) : (
                        <strong style={{ color: '#f3f4f6' }}>{shop.daily_request_limit}</strong>
                      )}
                    </td>

                    {/* Monthly Limit */}
                    <td style={{ padding: '14px 12px' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editMonthlyLimit}
                          onChange={(e) => setEditMonthlyLimit(Number(e.target.value))}
                          style={{
                            width: '80px',
                            padding: '6px',
                            borderRadius: '6px',
                            backgroundColor: '#18181b',
                            border: '1px solid #a855f7',
                            color: '#ffffff',
                            fontWeight: 700,
                          }}
                        />
                      ) : (
                        <strong style={{ color: '#f3f4f6' }}>{shop.monthly_request_limit}</strong>
                      )}
                    </td>

                    {/* 24h Usage */}
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ color: shop.daily_used >= shop.daily_request_limit ? '#ef4444' : '#e5e7eb' }}>
                        {shop.daily_used} / {shop.daily_request_limit}
                      </span>
                    </td>

                    {/* 30d Usage */}
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ color: shop.monthly_used >= shop.monthly_request_limit ? '#ef4444' : '#e5e7eb' }}>
                        {shop.monthly_used} / {shop.monthly_request_limit}
                      </span>
                    </td>

                    {/* Remaining */}
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ color: '#34d399', fontWeight: 600 }}>{shop.remaining_daily} daily</span>,{' '}
                        <span style={{ color: '#a78bfa', fontWeight: 600 }}>{shop.remaining_monthly} monthly</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveShopLimits(shop.tenant_id)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 600,
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              <Check style={{ width: '14px', height: '14px' }} />
                            </button>
                            <button
                              onClick={() => setEditingShopId(null)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                color: '#9ca3af',
                                border: 'none',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingShopId(shop.tenant_id);
                                setEditDailyLimit(shop.daily_request_limit);
                                setEditMonthlyLimit(shop.monthly_request_limit);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                                color: '#c084fc',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <Edit2 style={{ width: '13px', height: '13px' }} />
                              Limits
                            </button>

                            <button
                              onClick={() => handleToggleShopAi(shop.tenant_id, shop.ai_enabled)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                backgroundColor: shop.ai_enabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: shop.ai_enabled ? '#f87171' : '#34d399',
                                border: `1px solid ${shop.ai_enabled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {shop.ai_enabled ? 'Disable' : 'Enable'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Central AI Ledger Request History */}
      <div style={{ backgroundColor: '#09090b', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock style={{ width: '20px', height: '20px', color: '#38bdf8' }} />
              Central AI Usage Ledger & Request History
            </h2>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', margin: 0 }}>
              Immutable request log capturing model execution, token counts, costs, and statuses.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#e5e7eb' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '10px' }}>Time</th>
                <th style={{ padding: '10px' }}>Shop</th>
                <th style={{ padding: '10px' }}>Feature</th>
                <th style={{ padding: '10px' }}>Model</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px' }}>Tokens (In / Out / Total)</th>
                <th style={{ padding: '10px' }}>Est. Cost</th>
                <th style={{ padding: '10px' }}>Request ID</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                    No AI requests logged in ledger yet.
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px', color: '#9ca3af', fontFamily: 'monospace' }}>
                      {new Date(row.requested_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{row.tenant_name}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>
                        {row.feature}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#c084fc' }}>{row.model}</td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '10px',
                          backgroundColor:
                            row.status === 'success'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : row.status === 'failed'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(234, 179, 8, 0.2)',
                          color:
                            row.status === 'success'
                              ? '#34d399'
                              : row.status === 'failed'
                              ? '#f87171'
                              : '#facc15',
                        }}
                      >
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      {row.input_tokens} / {row.output_tokens} (<strong>{row.total_tokens}</strong>)
                    </td>
                    <td style={{ padding: '10px', color: '#facc15', fontWeight: 600 }}>
                      ${Number(row.estimated_cost).toFixed(5)}
                    </td>
                    <td style={{ padding: '10px', color: '#6b7280', fontFamily: 'monospace', fontSize: '11px' }}>
                      {row.request_id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
