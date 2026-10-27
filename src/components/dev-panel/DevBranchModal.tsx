'use client';

import React, { useState, useEffect } from 'react';
import { X, KeyRound, Plus, Trash2, Mail, Phone, MapPin, Building, Globe } from 'lucide-react';
import { Tenant, BranchType, InitialAccountsData } from '@/types/dev';
import { Owner } from '@/types';

interface DevBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    branchData: Partial<Tenant>,
    initialAccounts?: InitialAccountsData
  ) => Promise<boolean>;
  editingBranch?: Tenant | null;
  owners?: Owner[];
}

export const DevBranchModal: React.FC<DevBranchModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingBranch,
  owners = [],
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<BranchType>('shop');
  const [slug, setSlug] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');

  // Owner Mode for Branch Expansion
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>('existing');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');

  // Initial Login Accounts fields
  const [ceoUsername, setCeoUsername] = useState('');
  const [ceoPassword, setCeoPassword] = useState('');
  const [counters, setCounters] = useState<Array<{ username: string; password: string; name: string }>>([
    { username: 'counter1', password: '123', name: 'Counter 01 (Main POS)' }
  ]);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (editingBranch) {
      setName(editingBranch.name || '');
      setType(editingBranch.type || 'shop');
      const cleanSlug = (editingBranch.slug || '').replace(/^\/+/, '');
      setSlug(cleanSlug);
      setCity(editingBranch.city || '');
      setAddress(editingBranch.address || '');
      setPhone(editingBranch.phone || '');
      setEmail(editingBranch.email || '');
      setOwnerName(editingBranch.owner_name || '');
      setOwnerMode('existing');
      setSelectedOwnerId(editingBranch.owner_id || '');
      setCeoUsername('');
      setCeoPassword('');
      setCounters([{ username: 'counter1', password: '123', name: 'Counter 01 (Main POS)' }]);
    } else {
      setName('');
      setType('shop');
      setSlug('');
      setCity('');
      setAddress('');
      
      const hasOwners = owners && owners.length > 0;
      if (hasOwners) {
        const defaultOwner = owners[0];
        setOwnerMode('existing');
        setSelectedOwnerId(defaultOwner.id);
        setOwnerName(defaultOwner.name);
        setEmail(defaultOwner.email || '');
        setPhone(defaultOwner.phone || '');
      } else {
        setOwnerMode('new');
        setSelectedOwnerId('');
        setOwnerName('');
        setEmail('');
        setPhone('');
      }

      setCeoUsername('');
      setCeoPassword('');
      setCounters([
        { username: 'counter1', password: '123', name: 'Counter 01 (Main POS)' }
      ]);
    }
    setFormError('');
  }, [editingBranch, isOpen, owners]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingBranch) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setSlug(generatedSlug);
      const prefix = generatedSlug ? `${generatedSlug.replace(/-paints?|-paint-house?/g, '')}_` : '';
      if (!ceoUsername && val) {
        setCeoUsername(`${prefix}ceo`);
      }
      setCounters(prev => {
        if (prev.length === 1 && (prev[0].username === 'counter1' || prev[0].username.endsWith('_counter1') || prev[0].username.endsWith('_c1'))) {
          return [{ ...prev[0], username: prefix ? `${prefix}counter1` : 'counter1' }];
        }
        return prev;
      });
    }
  };

  const addCounter = () => {
    const nextIdx = counters.length + 1;
    const prefix = slug ? `${slug.replace(/-paints?|-paint-house?/g, '')}_` : '';
    setCounters([
      ...counters,
      { username: `${prefix}counter${nextIdx}`, password: '123', name: `Counter 0${nextIdx} (POS Register)` }
    ]);
  };

  const removeCounter = (index: number) => {
    if (counters.length > 1) {
      setCounters(counters.filter((_, i) => i !== index));
    }
  };

  const updateCounter = (index: number, field: 'username' | 'password' | 'name', value: string) => {
    const updated = [...counters];
    updated[index][field] = value;
    setCounters(updated);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !slug.trim()) {
      setFormError('Shop Name and URL identifier (slug) are required');
      return;
    }

    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    const isExistingOwner = !editingBranch && ownerMode === 'existing' && Boolean(selectedOwnerId);

    setLoading(true);
    try {
      const success = await onSave(
        {
          id: editingBranch?.id,
          name: name.trim(),
          type,
          slug: cleanSlug,
          city: city.trim() || 'Karachi',
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          owner_name: ownerName.trim(),
          owner_id: isExistingOwner ? selectedOwnerId : editingBranch?.owner_id,
        },
        !editingBranch
          ? {
              ceoUsername: isExistingOwner ? undefined : (ceoUsername.trim() || undefined),
              ceoPassword: isExistingOwner ? undefined : (ceoPassword || undefined),
              counters: counters.map(c => ({
                username: c.username.trim().toLowerCase(),
                password: c.password,
                name: c.name.trim(),
              })),
            }
          : undefined
      );

      if (success) {
        onClose();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save shop and branches');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aura-modal-overlay">
      <div className="aura-modal-box" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              {editingBranch ? (
                <>
                  Edit Shop Enterprise: <span style={{ color: '#D4AF37' }}>{editingBranch.name}</span>
                </>
              ) : (
                <>
                  Provision New <span style={{ color: '#D4AF37' }}>Paint Shop &amp; Branches</span>
                </>
              )}
            </h2>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '3px 0 0' }}>
              Create master URL route, contact credentials, and provision counter staff logins for each branch
            </p>
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
          {/* Business Ownership Selector for New Branch */}
          {!editingBranch && owners.length > 0 && (
            <div style={{ padding: '14px', borderRadius: '14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Business Ownership Mode
                </span>
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerMode('existing');
                      if (owners.length > 0) {
                        const o = owners.find(x => x.id === selectedOwnerId) || owners[0];
                        setSelectedOwnerId(o.id);
                        setOwnerName(o.name);
                        setEmail(o.email || '');
                        setPhone(o.phone || '');
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: ownerMode === 'existing' ? '#D4AF37' : 'transparent',
                      color: ownerMode === 'existing' ? '#000' : '#9ca3af',
                      transition: 'all 0.2s',
                    }}
                  >
                    Branch Expansion (Existing Owner)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerMode('new');
                      setSelectedOwnerId('');
                      setOwnerName('');
                      setEmail('');
                      setPhone('');
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: ownerMode === 'new' ? '#D4AF37' : 'transparent',
                      color: ownerMode === 'new' ? '#000' : '#9ca3af',
                      transition: 'all 0.2s',
                    }}
                  >
                    + New Business / Owner
                  </button>
                </div>
              </div>

              {ownerMode === 'existing' && (
                <div>
                  <label className="aura-form-label" style={{ color: '#F3E5AB' }}>SELECT EXISTING BUSINESS / OWNER *</label>
                  <select
                    className="aura-form-input"
                    value={selectedOwnerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedOwnerId(id);
                      const o = owners.find(x => x.id === id);
                      if (o) {
                        setOwnerName(o.name);
                        setEmail(o.email || '');
                        setPhone(o.phone || '');
                      }
                    }}
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', backgroundColor: '#18181b' }}
                  >
                    {owners.map(o => (
                      <option key={o.id} value={o.id} style={{ backgroundColor: '#18181b', color: '#fff' }}>
                        {o.name} {o.email ? `(${o.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Field 1: Shop Name */}
            <div>
              <label className="aura-form-label">SHOP / BUSINESS NAME *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Hamza &amp; Son's Paints"
                className="aura-form-input"
              />
            </div>

            {/* Field 2: URL Slug */}
            <div>
              <label className="aura-form-label">SHOP URL IDENTIFIER (SLUG) *</label>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0 12px' }}>
                <span style={{ color: '#D4AF37', fontWeight: 700, marginRight: '6px' }}>/</span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.replace(/^\/+/, ''))}
                  placeholder="hamza-sons-paints"
                  style={{ width: '100%', background: 'transparent', border: 'none', color: '#D4AF37', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '13px', outline: 'none', padding: '10px 0' }}
                />
              </div>
            </div>

            {/* Field 3: City / Hub */}
            <div>
              <label className="aura-form-label">CITY / MAIN LOCATION</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Karachi / Lahore / Islamabad"
                className="aura-form-input"
              />
            </div>

            {/* Field 4: Owner Name */}
            <div>
              <label className="aura-form-label">SHOP OWNER (CEO) NAME</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Hamza Rajput"
                className="aura-form-input"
                disabled={ownerMode === 'existing' && !editingBranch && Boolean(selectedOwnerId)}
              />
            </div>

            {/* Field 5: Email Address */}
            <div>
              <label className="aura-form-label">EMAIL ADDRESS</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. owner@hamzapaint.com"
                className="aura-form-input"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
                disabled={ownerMode === 'existing' && !editingBranch && Boolean(selectedOwnerId)}
              />
            </div>

            {/* Field 6: Phone Number */}
            <div>
              <label className="aura-form-label">PHONE NUMBER</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300-1234567"
                className="aura-form-input"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
                disabled={ownerMode === 'existing' && !editingBranch && Boolean(selectedOwnerId)}
              />
            </div>

            {/* Field 7: Physical Address */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="aura-form-label">SHOP / GODOWN PHYSICAL ADDRESS</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Shop #42, Main Commercial Market, Timber Market Road"
                className="aura-form-input"
              />
            </div>
          </div>

          {/* New Shop Provisioning: CEO & Multi-Branch Counters Box */}
          {!editingBranch && (
            <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* CEO Account: Reused Banner vs Fresh Input */}
              {ownerMode === 'existing' && selectedOwnerId ? (
                <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.25)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <KeyRound style={{ width: '22px', height: '22px', color: '#D4AF37', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#F3E5AB' }}>
                      Existing Master CEO Account Reused
                    </div>
                    <div style={{ fontSize: '11px', color: '#d1d5db', marginTop: '3px', lineHeight: 1.4 }}>
                      The CEO of <strong>{ownerName || 'this business'}</strong> will automatically manage this new branch with their existing login credentials. No duplicate CEO account is created.
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#F3E5AB', marginBottom: '10px' }}>
                    <KeyRound style={{ width: '14px', height: '14px', color: '#D4AF37' }} />
                    <span>Shop CEO Master Account</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="aura-form-label" style={{ color: '#F3E5AB' }}>CEO Username</label>
                      <input
                        type="text"
                        value={ceoUsername}
                        onChange={(e) => setCeoUsername(e.target.value)}
                        placeholder="hamza_ceo"
                        className="aura-form-input"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      />
                    </div>
                    <div>
                      <label className="aura-form-label" style={{ color: '#F3E5AB' }}>CEO Password</label>
                      <input
                        type="password"
                        value={ceoPassword}
                        onChange={(e) => setCeoPassword(e.target.value)}
                        placeholder="••••••••"
                        className="aura-form-input"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* POS Cash Registers Setup */}
              <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa' }}>
                    POS Cash Registers ({counters.length} Active Cashiers)
                  </div>
                  <button
                    type="button"
                    onClick={addCounter}
                    className="aura-btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px', gap: '4px' }}
                  >
                    <Plus style={{ width: '12px', height: '12px' }} />
                    <span>+ Add Counter Register</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {counters.map((c, idx) => (
                    <div key={idx} style={{ padding: '10px 12px', borderRadius: '12px', backgroundColor: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '2px' }}>Counter / Register Name</span>
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => updateCounter(idx, 'name', e.target.value)}
                          placeholder={`Counter 0${idx + 1} (POS)`}
                          className="aura-form-input"
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '2px' }}>Login Username</span>
                        <input
                          type="text"
                          value={c.username}
                          onChange={(e) => updateCounter(idx, 'username', e.target.value)}
                          placeholder={`counter${idx + 1}`}
                          className="aura-form-input"
                          style={{ padding: '6px 10px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', display: 'block', marginBottom: '2px' }}>Password</span>
                        <input
                          type="password"
                          value={c.password}
                          onChange={(e) => updateCounter(idx, 'password', e.target.value)}
                          placeholder="••••••"
                          className="aura-form-input"
                          style={{ padding: '6px 10px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}
                        />
                      </div>
                      {counters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCounter(idx)}
                          style={{ padding: '6px', borderRadius: '6px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', marginTop: '14px' }}
                          title="Remove counter register"
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
              {loading ? 'Provisioning...' : editingBranch ? 'Save Changes' : `Provision Shop (${counters.length} Branches)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
