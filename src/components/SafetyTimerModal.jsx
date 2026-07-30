import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';

export function SafetyTimerModal({ isOpen, onClose, onTimerExpired }) {
  const [selectedMins, setSelectedMins] = useState(15);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStartTimer = (mins) => {
    setSelectedMins(mins);
    setRemainingSeconds(mins * 60);
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
    onClose();
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
          onClick={handleCancelTimer}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.5rem' }}>
              <button
                className="btn-secondary-dark"
                onClick={() => handleStartTimer(15)}
                style={{ border: 'none', padding: '1rem', borderRadius: '16px', flexDirection: 'column', height: 'auto' }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>15 Mins</div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>Quick Trip</div>
              </button>

              <button
                className="btn-secondary-dark"
                onClick={() => handleStartTimer(30)}
                style={{ border: 'none', padding: '1rem', borderRadius: '16px', flexDirection: 'column', height: 'auto' }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>30 Mins</div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>Longer Ride</div>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, margin: '1rem 0 1.5rem', color: 'var(--text-primary)' }}>
              {formattedTime}
            </div>

            <button
              className="btn-primary-dark"
              onClick={handleCancelTimer}
              style={{ border: 'none', width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
            >
              I'm Safe (Cancel Timer)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
