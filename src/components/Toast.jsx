import React, { useEffect } from 'react';
import { CheckCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';

export function Toast({ message, onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const isAlert = message.toLowerCase().includes('caught') || message.toLowerCase().includes('evaluating') || message.toLowerCase().includes('recording');

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '84px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: '90%',
        maxWidth: '380px',
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-elevated)',
        borderRadius: '16px',
        padding: '0.75rem 1rem',
        boxShadow: 'none',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        animation: 'toastSlideUp 0.45s cubic-bezier(0.32, 0.72, 0, 1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: isAlert ? '#fee2e2' : '#dcfce7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {isAlert ? (
            <InformationCircleIcon style={{ width: '18px', height: '18px', color: '#dc2626' }} />
          ) : (
            <CheckCircleIcon style={{ width: '18px', height: '18px', color: '#166534' }} />
          )}
        </div>

        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
          {message}
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '0.2rem',
          marginLeft: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <XMarkIcon style={{ width: '16px', height: '16px' }} />
      </button>
    </div>
  );
}
