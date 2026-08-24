'use client';

import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Building2,
  Search
} from 'lucide-react';
import { UserItem, UserRole } from '@/types/dev';

interface DevUsersViewProps {
  users: UserItem[];
  onAddUser: () => void;
  onEditUser: (user: UserItem) => void;
  onDeleteUser: (id: string) => void;
}

export const DevUsersView: React.FC<DevUsersViewProps> = ({
  users,
  onAddUser,
  onEditUser,
  onDeleteUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.tenants?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRolePill = (role: UserRole) => {
    switch (role) {
      case 'developer':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              backgroundColor: 'rgba(212, 175, 55, 0.2)',
              color: '#D4AF37',
              border: '1px solid rgba(212, 175, 55, 0.4)',
            }}
          >
            DEVELOPER
          </span>
        );
      case 'ceo':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              backgroundColor: 'rgba(243, 229, 171, 0.2)',
              color: '#F3E5AB',
              border: '1px solid rgba(243, 229, 171, 0.3)',
            }}
          >
            CEO
          </span>
        );
      case 'godown_staff':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            INCHARGE
          </span>
        );
      case 'staff':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            STAFF
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#9ca3af',
            }}
          >
            {role}
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 300, color: '#ffffff', letterSpacing: '-0.025em', margin: '0 0 4px' }}>
            All System <span style={{ color: '#D4AF37', fontWeight: 700 }}>Accounts</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
            Super Developer, CEO, Cashiers, and Godown Incharges
          </p>
        </div>

        <button
          onClick={onAddUser}
          className="aura-btn-gold"
        >
          <Plus style={{ width: '16px', height: '16px', strokeWidth: 3 }} />
          <span>+ Add User Account</span>
        </button>
      </div>

      {/* Search Bar */}
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
            placeholder="Search users by username, role, branch..."
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
        <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace" }}>
          {filteredUsers.length} total accounts
        </span>
      </div>

      {/* Accounts Table Container */}
      <div className="aura-table-container">
        <div style={{ overflowX: 'auto' }}>
          <table className="aura-table">
            <thead>
              <tr>
                <th>USERNAME</th>
                <th>FULL NAME</th>
                <th>ROLE</th>
                <th>ASSIGNED BRANCH</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                    No system accounts found matching query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    {/* Username */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#D4AF37',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: '12px',
                          }}
                        >
                          {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#ffffff', display: 'block' }}>
                            {user.username}
                          </span>
                          {user.email && (
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                              {user.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Full Name */}
                    <td style={{ fontWeight: 600, color: '#e2e8f0' }}>
                      {user.full_name || '—'}
                    </td>

                    {/* Role Pill */}
                    <td>
                      {getRolePill(user.role)}
                    </td>

                    {/* Assigned Branch */}
                    <td>
                      <span style={{ fontSize: '12px', color: '#d1d5db', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 style={{ width: '14px', height: '14px', color: '#D4AF37', flexShrink: 0 }} />
                        <span>
                          {user.tenants ? `${user.tenants.name} (/${user.tenants.slug})` : (user.role === 'developer' ? 'Global Access' : '—')}
                        </span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      {user.role === 'developer' ? (
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#6b7280',
                            padding: '4px 8px',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: '6px',
                          }}
                        >
                          Protected
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => onEditUser(user)}
                            className="aura-btn-secondary"
                            style={{ padding: '8px', borderRadius: '10px' }}
                            title="Edit User Details"
                          >
                            <Edit3 style={{ width: '14px', height: '14px' }} />
                          </button>

                          {deleteConfirmId === user.id ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                onClick={() => {
                                  onDeleteUser(user.id);
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
                              onClick={() => setDeleteConfirmId(user.id)}
                              className="aura-btn-danger"
                              style={{ padding: '8px', borderRadius: '10px' }}
                              title="Delete User"
                            >
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          )}
                        </div>
                      )}
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
};
