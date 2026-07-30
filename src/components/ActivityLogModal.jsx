import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';

export function ActivityLogModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const sampleLogs = [
    { time: 'Just now', title: 'System Check', desc: 'Microphone & Motion active' },
    { time: '14:20', title: 'Location Fixed', desc: 'Keffi-Abuja Corridor' },
    { time: '12:05', title: 'Sensors Check', desc: 'Battery & GPS healthy' },
    { time: 'Yesterday', title: 'Recording Saved', desc: '1 saved recording in Vault' }
  ];

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
          maxWidth: '400px',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          padding: '1.5rem 1.25rem',
          position: 'relative',
          border: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div className="micro-label" style={{ marginBottom: 0 }}>SYSTEM HISTORY</div>
            <h3 className="headline-md">Activity History</h3>
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

        {/* Clean 1-Line History Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {sampleLogs.map((log, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '0.75rem',
                borderBottom: idx < sampleLogs.length - 1 ? '1px solid var(--bg-elevated)' : 'none'
              }}
            >
              <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                • <strong style={{ fontWeight: 600 }}>{log.title}</strong> — {log.desc}
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: '0.5rem' }}>
                {log.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
