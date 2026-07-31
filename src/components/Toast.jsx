import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';

export function Toast({ message, onClose, duration = 3000 }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!message) return;
    setIsExiting(false);

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        if (onClose) onClose();
      }, 280); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const isAlert = message.toLowerCase().includes('evaluating') || message.toLowerCase().includes('recording') || message.toLowerCase().includes('sensor');

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 280);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '84px',
        left: '50%',
        zIndex: 1000,
        width: '90%',
        maxWidth: '380px',
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-elevated)',
        borderRadius: '16px',
        padding: '0.75rem 1rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transform: 'translateX(-50%)',
        animation: isExiting
          ? 'toastFadeOut 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards'
          : 'toastSpringPop 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
      }}
    >
      <style>{`
        @keyframes toastSpringPop {
          0% { opacity: 0; transform: translate(-50%, 20px) scale(0.92); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes toastFadeOut {
          0% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -10px) scale(0.95); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: isAlert ? '#fef3c7' : '#dcfce7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {isAlert ? (
            <InformationCircleIcon style={{ width: '18px', height: '18px', color: '#d97706' }} />
          ) : (
            <CheckCircleIcon style={{ width: '18px', height: '18px', color: '#166534' }} />
          )}
        </div>

        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
          {message}
        </div>
      </div>

      <button
        onClick={handleDismiss}
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
