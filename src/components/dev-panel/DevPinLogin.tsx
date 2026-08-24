'use client';

import React, { useState } from 'react';
import { Shield, KeyRound, AlertTriangle, LogIn, Lock } from 'lucide-react';
import './aura-panel.css';

interface DevPinLoginProps {
  onSuccess: () => void;
}

const SECRET_DEV_PIN = 'dev2026';

export const DevPinLogin: React.FC<DevPinLoginProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'pin' | 'credentials'>('pin');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() === SECRET_DEV_PIN) {
      sessionStorage.setItem('aura_dev_auth', 'true');
      onSuccess();
    } else {
      setError('Invalid developer PIN. Access denied.');
    }
  };

  const handleCredsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success && data.user?.role === 'developer') {
        sessionStorage.setItem('aura_dev_auth', 'true');
        onSuccess();
      } else {
        setError(data.error || 'Invalid Developer credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#050505',
        color: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Background Ambient Luxury Lighting */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '25%',
          width: '600px',
          height: '400px',
          backgroundColor: 'rgba(212, 175, 55, 0.08)',
          borderRadius: '9999px',
          filter: 'blur(150px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          right: '25%',
          width: '500px',
          height: '400px',
          backgroundColor: 'rgba(138, 109, 59, 0.08)',
          borderRadius: '9999px',
          filter: 'blur(150px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
        {/* Top Emblem */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #D4AF37, #8A6D3B)',
              padding: '1.5px',
              boxShadow: '0 0 25px rgba(212, 175, 55, 0.35)',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#050505',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield style={{ width: '32px', height: '32px', color: '#D4AF37' }} />
            </div>
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 300,
              color: '#ffffff',
              letterSpacing: '-0.025em',
              margin: '0 0 4px',
            }}
          >
            Aura <span style={{ color: '#D4AF37', fontWeight: 700 }}>Dev Hub</span>
          </h1>
          <p
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Restricted Access • Super Administrator
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            padding: '32px',
            borderRadius: '24px',
            backgroundColor: 'rgba(10, 10, 10, 0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(212, 175, 55, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Mode Switch Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '12px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('pin');
                setError('');
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: mode === 'pin' ? '#D4AF37' : 'transparent',
                color: mode === 'pin' ? '#000000' : '#9ca3af',
              }}
            >
              Master PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('credentials');
                setError('');
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: mode === 'credentials' ? '#D4AF37' : 'transparent',
                color: mode === 'credentials' ? '#000000' : '#9ca3af',
              }}
            >
              Developer Login
            </button>
          </div>

          {/* PIN Form */}
          {mode === 'pin' ? (
            <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#D4AF37',
                    fontWeight: 700,
                    marginBottom: '8px',
                    textAlign: 'center',
                  }}
                >
                  Enter Developer Security PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    textAlign: 'center',
                    fontSize: '20px',
                    letterSpacing: '0.4em',
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: '12px',
                  }}
                >
                  <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '9999px',
                  backgroundColor: '#D4AF37',
                  color: '#000000',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  boxShadow: '0 4px 25px rgba(212, 175, 55, 0.3)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s',
                }}
              >
                <LogIn style={{ width: '16px', height: '16px' }} />
                <span>Unlock Developer Console</span>
              </button>
            </form>
          ) : (
            /* Credentials Form */
            <form onSubmit={handleCredsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#9ca3af',
                    fontWeight: 700,
                    marginBottom: '6px',
                  }}
                >
                  Developer Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '13px',
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#9ca3af',
                    fontWeight: 700,
                    marginBottom: '6px',
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '13px',
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: '12px',
                  }}
                >
                  <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '9999px',
                  backgroundColor: '#D4AF37',
                  color: '#000000',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  boxShadow: '0 4px 25px rgba(212, 175, 55, 0.3)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: loading ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <LogIn style={{ width: '16px', height: '16px' }} />
                <span>{loading ? 'Authenticating...' : 'Sign In as Developer'}</span>
              </button>
            </form>
          )}

          {/* Footer note */}
          <p
            style={{
              fontSize: '11px',
              color: '#6b7280',
              textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              margin: '8px 0 0',
            }}
          >
            PaintERP Multi-Tenant Infrastructure Suite v2.4
          </p>
        </div>
      </div>
    </div>
  );
};
