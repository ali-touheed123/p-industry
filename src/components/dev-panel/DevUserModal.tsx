'use client';

import React, { useState, useEffect } from 'react';
import { X, UserCheck, Mail } from 'lucide-react';
import { UserItem, UserRole, Tenant } from '@/types/dev';

interface DevUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: {
    id?: string;
    username: string;
    password?: string;
    full_name?: string;
    role: UserRole;
    tenant_id?: string;
    email?: string;
    can_use_special_receipt?: boolean;
  }) => Promise<boolean>;
  editingUser?: UserItem | null;
  branches: Tenant[];
  preSelectedTenantId?: string;
}

export const DevUserModal: React.FC<DevUserModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingUser,
  branches,
  preSelectedTenantId = '',
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [tenantId, setTenantId] = useState('');
  const [canUseSpecialReceipt, setCanUseSpecialReceipt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Store latest preSelectedTenantId in a ref so useEffect deps array size stays constant
  const preSelectedRef = React.useRef(preSelectedTenantId);
  preSelectedRef.current = preSelectedTenantId;

  useEffect(() => {
    if (editingUser) {
      setUsername(editingUser.username || '');
      setFullName(editingUser.full_name || '');
      setEmail(editingUser.email || '');
      setRole(editingUser.role || 'staff');
      setTenantId(editingUser.tenant_id || '');
      setCanUseSpecialReceipt(Boolean(editingUser.can_use_special_receipt));
      setPassword('');
    } else {
      setUsername('');
      setPassword('');
      setFullName('');
      setEmail('');
      setRole('staff');
      setCanUseSpecialReceipt(false);
      // Read latest preSelectedTenantId via ref — avoids changing deps array size
      setTenantId(preSelectedRef.current || (branches.length > 0 ? branches[0].id : ''));
    }
    setFormError('');
  }, [editingUser, isOpen, branches]);

  if (!isOpen) return null;

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'developer') {
      setTenantId('');
    } else if (!tenantId && branches.length > 0) {
      setTenantId(branches[0].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!username.trim()) {
      setFormError('Username is required');
      return;
    }

    if (!editingUser && !password.trim()) {
      setFormError('Password is required when creating a new account');
      return;
    }

    setLoading(true);
    try {
      const cleanUsername = username.trim().toLowerCase();
      const success = await onSave({
        id: editingUser?.id,
        username: cleanUsername,
        password: password.trim() || undefined,
        full_name: fullName.trim() || username.trim(),
        role,
        tenant_id: role === 'developer' ? undefined : (tenantId || undefined),
        email: email.trim() || `${cleanUsername}@pyntflow.com`,
        can_use_special_receipt: role === 'staff' ? canUseSpecialReceipt : false,
      });

      if (success) {
        onClose();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aura-modal-overlay">
      <div className="aura-modal-box" style={{ maxWidth: '600px' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37' }}>
              <UserCheck style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                {editingUser ? (
                  <>
                    Edit Account: <span style={{ color: '#D4AF37' }}>{editingUser.username}</span>
                  </>
                ) : (
                  <>
                    Create System <span style={{ color: '#D4AF37' }}>User Account</span>
                  </>
                )}
              </h2>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                Credentials will be stored securely in Supabase app_users table
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '9999px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#9ca3af', border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer' }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Error message */}
        {formError && (
          <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '12px' }}>
            {formError}
          </div>
        )}

        {/* Form Grid */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Field 1: USERNAME */}
            <div>
              <label className="aura-form-label">LOGIN USERNAME *</label>
              <input
                type="text"
                required
                disabled={!!editingUser}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. counter1 / manager1"
                className="aura-form-input"
                style={{ fontFamily: "'JetBrains Mono', monospace", opacity: editingUser ? 0.6 : 1 }}
              />
            </div>

            {/* Field 2: PASSWORD */}
            <div>
              <label className="aura-form-label">
                PASSWORD {editingUser ? '(LEAVE BLANK TO KEEP)' : '*'}
              </label>
              <input
                type="password"
                required={!editingUser}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="aura-form-input"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>

            {/* Field 3: FULL NAME */}
            <div>
              <label className="aura-form-label">FULL NAME / LABEL</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Asad (Counter 1 Staff)"
                className="aura-form-input"
              />
            </div>

            {/* Field 4: EMAIL ADDRESS */}
            <div>
              <label className="aura-form-label">EMAIL ADDRESS</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. staff@pyntflow.com"
                className="aura-form-input"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>

            {/* Field 5: ACCOUNT ROLE */}
            <div>
              <label className="aura-form-label">ACCOUNT ROLE *</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="aura-form-select"
              >
                <option value="staff">Staff / Cashier (POS &amp; Billing)</option>
                <option value="ceo">CEO / Executive Lead (Owner View)</option>
                <option value="godown_staff">Godown Staff (Transfers &amp; Stock)</option>
                <option value="developer">Developer / Super Admin (Full Control)</option>
              </select>
            </div>

            {/* Field 6: ASSIGNED BRANCH */}
            <div>
              <label className="aura-form-label">ASSIGNED BRANCH</label>
              <select
                value={role === 'developer' ? '' : tenantId}
                disabled={role === 'developer'}
                onChange={(e) => setTenantId(e.target.value)}
                className="aura-form-select"
                style={{ opacity: role === 'developer' ? 0.6 : 1 }}
              >
                <option value="">Global Access (Developer / Unassigned)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (/{b.slug}) — {b.city || 'Karachi'}
                  </option>
                ))}
              </select>
            </div>

            {/* Field 7: SPECIAL RECEIPT PERMISSION (Only for Staff / Cashier) */}
            {role === 'staff' && (
              <div style={{ gridColumn: '1 / -1', padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e0e7ff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Special Receipt Feature Access</span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 700 }}>POS</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    Authorizes this cashier to design, brand-filter, and print unbranded/custom special receipts.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}>
                  <input
                    type="checkbox"
                    checked={canUseSpecialReceipt}
                    onChange={(e) => setCanUseSpecialReceipt(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#7c3aed', cursor: 'pointer' }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <button
              type="button"
              onClick={onClose}
              className="aura-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="aura-btn-gold"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Saving...' : editingUser ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
