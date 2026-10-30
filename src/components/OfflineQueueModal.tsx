'use client';

/**
 * src/components/OfflineQueueModal.tsx
 *
 * Phase 6: Offline Queue Inspector & Real-Time Sync Status Pill
 *
 * Features:
 * - Real-time sync status pill: Online / Offline / Syncing (N) / Needs Attention (N) / Waiting for Shift (N)
 * - Offline Queue Modal:
 *   - Lists all items in IndexedDB outbox (FIFO ordered)
 *   - Clear status indicators and human-readable error reasons
 *   - "Sync Now" trigger
 *   - Individual item "Retry" (resets backoff timer & re-queues)
 *   - "Export Queue (JSON)" for emergency offline backup download
 *   - "Discard" on needs_attention items (gated with CEO password + audit log)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Clock,
  Download,
  Trash2,
  X,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useConnectivity } from '@/lib/useConnectivity';
import {
  OutboxItem,
  getOutboxItems,
  getOutboxSummary,
  updateOutboxItem,
  removeOutboxItem,
} from '@/lib/offlineQueueStore';
import { syncOfflineQueue, subscribeToSyncUpdates } from '@/lib/syncEngine';
import { CeoPasswordModal } from '@/components/CeoPasswordModal';

interface OfflineQueueModalProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OfflineQueueModal({ tenantId, isOpen, onClose }: OfflineQueueModalProps) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [discardTargetId, setDiscardTargetId] = useState<string | null>(null);
  const [showCeoModal, setShowCeoModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'needs_attention'>('all');

  const { isOnline } = useConnectivity();

  const loadItems = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const all = await getOutboxItems(tenantId);
      setItems(all);
    } catch (e) {
      console.error('[OfflineQueueModal] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

  useEffect(() => {
    return subscribeToSyncUpdates(() => {
      if (isOpen) {
        loadItems();
      }
    });
  }, [isOpen, loadItems]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await syncOfflineQueue(tenantId);
      await loadItems();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryItem = async (item: OutboxItem) => {
    await updateOutboxItem(item.id, {
      status: 'pending',
      nextRetryAt: null,
      lastError: null,
    });
    handleSyncNow();
  };

  const handleExportJson = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(items, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `pyntflow-offline-queue-${tenantId}-${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error('Export error:', e);
    }
  };

  const handleRequestDiscard = (itemId: string) => {
    setDiscardTargetId(itemId);
    setShowCeoModal(true);
  };

  const handleCeoApprovedDiscard = async () => {
    if (discardTargetId) {
      await removeOutboxItem(discardTargetId);
      setShowCeoModal(false);
      setDiscardTargetId(null);
      await loadItems();
    }
  };

  if (!isOpen) return null;

  const filteredItems = items.filter((it) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'pending') return it.status === 'pending' || it.status === 'syncing';
    if (selectedFilter === 'needs_attention') return it.status === 'needs_attention';
    return true;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isOnline ? '#DCFCE7' : '#FEE2E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isOnline ? '#166534' : '#991B1B',
              }}
            >
              {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Offline Sales Queue & Sync Status
              </h2>
              <p style={{ fontSize: '11px', color: '#64748B', margin: 0, marginTop: '2px' }}>
                {isOnline ? 'Online — Automatic background sync is active' : 'Offline — Sales are queued locally in browser'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setSelectedFilter('all')}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedFilter === 'all' ? '#0F172A' : '#F1F5F9',
                color: selectedFilter === 'all' ? '#FFFFFF' : '#475569',
              }}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setSelectedFilter('pending')}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedFilter === 'pending' ? '#0284C7' : '#F1F5F9',
                color: selectedFilter === 'pending' ? '#FFFFFF' : '#475569',
              }}
            >
              Pending ({items.filter((i) => i.status === 'pending' || i.status === 'syncing').length})
            </button>
            <button
              onClick={() => setSelectedFilter('needs_attention')}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedFilter === 'needs_attention' ? '#DC2626' : '#F1F5F9',
                color: selectedFilter === 'needs_attention' ? '#FFFFFF' : '#475569',
              }}
            >
              Needs Attention ({items.filter((i) => i.status === 'needs_attention').length})
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExportJson}
              disabled={items.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                cursor: items.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Download size={14} />
              Export JSON
            </button>
            <button
              onClick={handleSyncNow}
              disabled={!isOnline || isSyncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#FFFFFF',
                backgroundColor: isOnline && !isSyncing ? '#059669' : '#94A3B8',
                border: 'none',
                borderRadius: '6px',
                cursor: isOnline && !isSyncing ? 'pointer' : 'not-allowed',
              }}
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: '260px' }}>
          {loading && items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748B', fontSize: '13px' }}>
              Loading offline queue…
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', margin: 0 }}>
                No offline sales in queue
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                All transactions on this terminal are fully synchronized with the central database.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredItems.map((item) => {
                const total = Number(item.payload?.net_total || 0);
                const clientName = item.payload?.client_name || 'Walk-in Customer';
                const itemCount = Array.isArray(item.payload?.items) ? item.payload.items.length : 0;
                const formattedTime = new Date(item.createdAtLocal).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const formattedDate = new Date(item.createdAtLocal).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      backgroundColor: item.status === 'needs_attention' ? '#FFF5F5' : '#FFFFFF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '12px',
                            color: '#0F172A',
                            backgroundColor: '#F1F5F9',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          #{item.localReceiptNo}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            color: item.type === 'special_sale' ? '#7C3AED' : '#2563EB',
                            backgroundColor: item.type === 'special_sale' ? '#F5F3FF' : '#EFF6FF',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {item.type === 'special_sale' ? 'Special Sale' : 'Normal Sale'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          {formattedDate} {formattedTime}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {item.status === 'syncing' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#0284C7',
                              backgroundColor: '#E0F2FE',
                              padding: '2px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            <RefreshCw size={11} className="animate-spin" /> Syncing
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#D97706',
                              backgroundColor: '#FEF3C7',
                              padding: '2px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            <Clock size={11} /> Pending
                          </span>
                        )}
                        {item.status === 'needs_attention' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#DC2626',
                              backgroundColor: '#FEE2E2',
                              padding: '2px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            <AlertTriangle size={11} /> Needs Attention
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#334155' }}>
                        <strong>{clientName}</strong> · {itemCount} item(s)
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                        Rs. {total.toLocaleString()}
                      </div>
                    </div>

                    {/* Error Banner if any */}
                    {item.lastError && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#B91C1C',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid #FECACA',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          lineHeight: '1.4',
                        }}
                      >
                        <strong>Error:</strong> {item.lastError.message}
                      </div>
                    )}

                    {/* Action buttons for item */}
                    {item.status === 'needs_attention' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => handleRetryItem(item)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          Retry Sync
                        </button>
                        <button
                          onClick={() => handleRequestDiscard(item.id)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: '1px solid #FCA5A5',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Trash2 size={12} /> Discard (CEO)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#64748B',
          }}
        >
          <span>All queued items remain stored locally until server confirms receipt.</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            Close
          </button>
        </div>
      </div>

      {showCeoModal && (
        <CeoPasswordModal
          tenantId={tenantId}
          onApproved={handleCeoApprovedDiscard}
          onCancel={() => {
            setShowCeoModal(false);
            setDiscardTargetId(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Compact status pill rendered on the POS navigation header.
 */
export function OfflineStatusPill({ tenantId }: { tenantId: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [summary, setSummary] = useState({
    pendingCount: 0,
    syncingCount: 0,
    needsAttentionCount: 0,
    totalUnsynced: 0,
  });

  const { isOnline } = useConnectivity();

  const refreshSummary = useCallback(async () => {
    if (!tenantId) return;
    try {
      const sum = await getOutboxSummary(tenantId);
      setSummary(sum);
    } catch {
      // non-fatal
    }
  }, [tenantId]);

  useEffect(() => {
    refreshSummary();
    return subscribeToSyncUpdates(refreshSummary);
  }, [refreshSummary]);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '11.5px',
          fontWeight: 600,
          border: '1px solid',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          backgroundColor:
            summary.needsAttentionCount > 0
              ? '#FEF2F2'
              : summary.totalUnsynced > 0
              ? '#FEF3C7'
              : isOnline
              ? '#ECFDF5'
              : '#FEE2E2',
          borderColor:
            summary.needsAttentionCount > 0
              ? '#FCA5A5'
              : summary.totalUnsynced > 0
              ? '#FCD34D'
              : isOnline
              ? '#A7F3D0'
              : '#FCA5A5',
          color:
            summary.needsAttentionCount > 0
              ? '#DC2626'
              : summary.totalUnsynced > 0
              ? '#B45309'
              : isOnline
              ? '#047857'
              : '#B91C1C',
        }}
        title="Click to open offline sync queue"
      >
        {isOnline ? (
          summary.syncingCount > 0 ? (
            <RefreshCw size={12} className="animate-spin text-sky-600" />
          ) : (
            <Wifi size={12} />
          )
        ) : (
          <WifiOff size={12} />
        )}

        <span>
          {summary.needsAttentionCount > 0
            ? `Sync Issue (${summary.needsAttentionCount})`
            : summary.syncingCount > 0
            ? `Syncing (${summary.totalUnsynced})`
            : summary.totalUnsynced > 0
            ? `Offline Queue (${summary.totalUnsynced})`
            : isOnline
            ? 'Online'
            : 'Offline'}
        </span>
      </button>

      {modalOpen && (
        <OfflineQueueModal
          tenantId={tenantId}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
