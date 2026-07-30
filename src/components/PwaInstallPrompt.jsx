import React, { useState, useEffect } from 'react';
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/solid';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('PWA installation accepted');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '82px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 2.5rem)',
        maxWidth: '400px',
        background: 'var(--bg-elevated)',
        borderRadius: '16px',
        padding: '0.85rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 99,
        border: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img
          src="/amana_favicon.png"
          alt="Amana"
          style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }}
        />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>
            Install Amana App
          </div>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
            Add to home screen for offline protection
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button
          onClick={handleInstallClick}
          className="btn-primary-dark"
          style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.75rem', border: 'none' }}
        >
          <ArrowDownTrayIcon style={{ width: '14px', height: '14px' }} />
          <span>Install</span>
        </button>

        <button
          onClick={() => setShowPrompt(false)}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.2rem'
          }}
        >
          <XMarkIcon style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
    </div>
  );
}
