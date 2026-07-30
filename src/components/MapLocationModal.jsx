import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { IncidentMap } from './IncidentMap';

export function MapLocationModal({ isOpen, onClose, gpsTrail = [] }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
    >
      <div
        className="card-flat"
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          padding: '1.5rem 1.25rem',
          position: 'relative',
          border: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div className="micro-label" style={{ marginBottom: 0 }}>LIVE MAP LOCATION</div>
            <h3 className="headline-md">Keffi-Abuja Corridor</h3>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.2rem'
            }}
          >
            <XMarkIcon style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        <IncidentMap gpsTrail={gpsTrail} height="280px" interactive />

        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Map tiles provided by CartoDB · No API keys required
        </div>
      </div>
    </div>
  );
}
