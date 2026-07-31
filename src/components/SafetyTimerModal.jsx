import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';

export function SafetyTimerModal({ isOpen, onClose, onTimerExpired }) {
  const [selectedMins, setSelectedMins] = useState(15);
  const [customMins, setCustomMins] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStartTimer = (mins) => {
    const validMins = Math.max(1, Math.min(1440, parseInt(mins, 10) || 15));
    setSelectedMins(validMins);
    setRemainingSeconds(validMins * 60);
    setIsActive(true);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsActive(false);
          onTimerExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setRemainingSeconds(0);
  };

  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

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
          padding: '1.75rem 1.5rem',
          textAlign: 'center',
          position: 'relative',
          border: 'none'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.2rem'
          }}
        >
          <XMarkIcon style={{ width: '20px', height: '20px' }} />
        </button>

        <div style={{ margin: '0 auto 1rem', width: '56px', height: '56px', background: 'var(--bg-elevated)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheckIcon style={{ width: '28px', height: '28px', color: 'var(--text-primary)' }} />
        </div>

        <h2 className="headline-lg" style={{ marginBottom: '0.4rem' }}>
          Safety Timer
        </h2>
        <p className="body-sm" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Taking a taxi or walking alone? Set a timer. If you don't tap "I'm Safe" before time runs out, Amana records automatically.
        </p>

        {!isActive ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <button
                className="btn-secondary-dark"
                onClick={() => handleStartTimer(5)}
                style={{ border: 'none', padding: '0.85rem', borderRadius: '14px', flexDirection: 'column', height: 'auto' }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>5 Mins</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Quick Walk</div>
              </button>

              <button
                className="btn-secondary-dark"
                onClick={() => handleStartTimer(15)}
                style={{ border: 'none', padding: '0.85rem', borderRadius: '14px', flexDirection: 'column', height: 'auto' }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>15 Mins</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Short Ride</div>
              </button>

              <button
                className="btn-secondary-dark"
                onClick={() => handleStartTimer(30)}
                style={{ border: 'none', padding: '0.85rem', borderRadius: '14px', flexDirection: 'column', height: 'auto' }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>30 Mins</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Taxi Trip</div>
              </button>

              <button
                className="btn-secondary-dark"
                onClick={() => handleStartTimer(60)}
                style={{ border: 'none', padding: '0.85rem', borderRadius: '14px', flexDirection: 'column', height: 'auto' }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>60 Mins</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Long Commute</div>
              </button>
            </div>

            {/* Custom Minutes Input */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="number"
                placeholder="Custom mins (e.g. 45)"
                value={customMins}
                onChange={(e) => setCustomMins(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-elevated)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => {
                  if (customMins) handleStartTimer(customMins);
                }}
                disabled={!customMins}
                style={{
                  border: 'none',
                  background: 'var(--text-primary)',
                  color: 'var(--bg-main)',
                  padding: '0.65rem 1rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: !customMins ? 0.5 : 1
                }}
              >
                Set
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, margin: '0.75rem 0 1.25rem', color: 'var(--text-primary)' }}>
              {formattedTime}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                className="btn-primary-dark"
                onClick={handleCancelTimer}
                style={{ border: 'none', width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
              >
                I'm Safe (Stop Timer)
              </button>

              <button
                onClick={onClose}
                style={{
                  border: 'none',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Hide (Keep Running in Background)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
