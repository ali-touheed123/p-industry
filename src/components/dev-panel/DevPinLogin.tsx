'use client';

import React, { useState } from 'react';
import { Shield, AlertTriangle, LogIn } from 'lucide-react';
import './aura-panel.css';

interface DevPinLoginProps {
  onSuccess: () => void;
}

export const DevPinLogin: React.FC<DevPinLoginProps> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/dev-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('aura_dev_auth', 'true');
        if (data.token) {
          sessionStorage.setItem('aura_dev_token', data.token);
        }
        onSuccess();
      } else {
        setError(data.error || 'Invalid Developer Master PIN. Access denied.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection to authentication server failed');
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
        {/* Top Branding & Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Official Pyntflow Logo */}
          <div style={{ marginBottom: '16px' }}>
            <img
              src="/logo.png"
              alt="Pyntflow"
              style={{
                height: '44px',
                width: 'auto',
                display: 'block',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 20px rgba(212, 175, 55, 0.3))',
              }}
            />
          </div>

          {/* Luxury Dev Hub Pill Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(212, 175, 55, 0.08)',
              border: '1px solid rgba(212, 175, 55, 0.28)',
              marginBottom: '12px',
            }}
          >
            <Shield style={{ width: '14px', height: '14px', color: '#D4AF37' }} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#D4AF37',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Developer Console
            </span>
          </div>

          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              margin: '0 0 6px',
            }}
          >
            Pyntflow <span style={{ color: '#D4AF37' }}>Dev Hub</span>
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: '#94a3b8',
              margin: 0,
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            }}
          >
            Restricted Infrastructure Access • Master PIN Required
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
          {/* PIN Form */}
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
                Enter Master Security PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                autoFocus
                disabled={loading}
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
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.15s',
              }}
            >
              <LogIn style={{ width: '16px', height: '16px' }} />
              <span>{loading ? 'Verifying PIN...' : 'Unlock Developer Console'}</span>
            </button>
          </form>

          {/* Footer note */}
          <p
            style={{
              fontSize: '11px',
              color: '#6b7280',
              textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              margin: '4px 0 0',
            }}
          >
            Pyntflow Multi-Tenant Infrastructure Suite v2.4
          </p>
        </div>
      </div>
    </div>
  );
};
