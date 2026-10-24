'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';
import { getCeoApproval, setCeoApproval } from '@/lib/ceoApprovalClient';

interface ModalProps {
  tenantId: string;
  onApproved: () => void;
  onCancel: () => void;
}

export function CeoPasswordModal({ tenantId, onApproved, onCancel }: ModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-ceo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Verification failed.');
        setPassword('');
        return;
      }
      if (data.token && data.expires_at) {
        setCeoApproval(tenantId, data.token, data.expires_at);
      }
      onApproved();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
    >
      <form
        onSubmit={submit}
        style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #E2E8F0', background: '#FFF7ED' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#9A3412', fontSize: '14px' }}>
            <Lock style={{ width: 16, height: 16 }} />
            CEO Approval Required
          </div>
          <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }} aria-label="Close">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
            Ye kaam sirf CEO ki ijazat se ho sakta hai. CEO ka password likhein. Approval 1 ghante tak chalegi.
          </p>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="CEO password"
            autoComplete="off"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
          />
          {error && (
            <div style={{ fontSize: '12px', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px 8px' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onCancel} style={{ padding: '8px 14px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#334155' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password || submitting}
              style={{ padding: '8px 14px', border: 'none', background: !password || submitting ? '#FDBA74' : '#EA580C', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: !password || submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ShieldCheck style={{ width: 14, height: 14 }} />
              {submitting ? 'Checking...' : 'Approve'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * useCeoApproval — wrap a protected action: `ensure(() => doThing())`.
 * Runs immediately when approval is not required (CEO role) or a valid approval is held,
 * otherwise opens the CEO password modal first. Render `modal` once in the component tree.
 */
export function useCeoApproval(tenantId: string | undefined, required: boolean) {
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const ensure = useCallback(
    (action: () => void) => {
      if (!required || !tenantId || getCeoApproval(tenantId)) {
        action();
        return;
      }
      pending.current = action;
      setOpen(true);
    },
    [required, tenantId]
  );

  const modal =
    open && tenantId ? (
      <CeoPasswordModal
        tenantId={tenantId}
        onCancel={() => { pending.current = null; setOpen(false); }}
        onApproved={() => {
          const run = pending.current;
          pending.current = null;
          setOpen(false);
          run?.();
        }}
      />
    ) : null;

  return { ensure, modal };
}
