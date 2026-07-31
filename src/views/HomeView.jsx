import React, { useState, useEffect, useRef } from 'react';
import {
  LockClosedIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/solid';
import { useLiveQuery } from 'dexie-react-hooks';
import { IncidentMap } from '../components/IncidentMap';
import { getAllAuditLogs } from '../services/db';
import { getAnalyserNode } from '../services/audioEngine';

export function HomeView({
  incidentCount = 0,
  currentGps = null,
  enginePhase = 'IDLE',
  activeIncident = null,
  onOpenVault,
  onOpenSafetyTimer,
  onOpenChat,
  onOpenSettings,
  onOpenMapModal,
  onOpenLogModal,
  onStopRecording
}) {
  const [activeBottomTab, setActiveBottomTab] = useState('map'); // 'map' | 'history'

  const defaultLat = currentGps?.lat || 8.9969;
  const defaultLng = currentGps?.lng || 7.3195;
  const isRecording = enginePhase !== 'IDLE';

  const auditLogs = useLiveQuery(() => getAllAuditLogs(), []) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
      
      {/* 1. TOP LISTENING STATUS HERO CARD */}
      <div
        className="card-flat"
        style={{
          padding: '1.5rem 1.25rem',
          textAlign: 'center',
          border: 'none',
          background: 'var(--bg-card)',
          borderRadius: '24px'
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', background: enginePhase === 'LONG_TERM' ? '#ccfbf1' : isRecording ? '#fef3c7' : '#dcfce7', borderRadius: '9999px', fontSize: '0.75rem', color: enginePhase === 'LONG_TERM' ? '#0f766e' : isRecording ? '#92400e' : '#166534', fontWeight: 600, marginBottom: '1rem' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: enginePhase === 'LONG_TERM' ? '#0d9488' : isRecording ? '#d97706' : '#16a34a' }} />
          {enginePhase === 'LONG_TERM'
            ? 'Saving Audio Package'
            : isRecording
              ? 'Checking Sound'
              : 'Listening Quietly'}
        </div>

        <h1 className="headline-lg" style={{ marginBottom: '0.3rem', fontSize: '1.35rem' }}>
          {enginePhase === 'LONG_TERM'
            ? 'Saving Recording'
            : isRecording
              ? 'Checking Sound...'
              : 'All Is Quiet'}
        </h1>
        <p className="body-sm" style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
          {enginePhase === 'LONG_TERM'
            ? 'Amana is saving audio safely on your phone.'
            : isRecording
              ? 'Listening for 45 seconds to see if everything is okay.'
              : 'Amana is listening quietly in the background.'}
        </p>

        {/* Real Web Audio API Waveform with Lerp Physics */}
        <RealAudioWaveform isRecording={isRecording} enginePhase={enginePhase} />
        {/* Stop session — text only, no UI change */}
        {isRecording && onStopRecording && (
          <button
            onClick={onStopRecording}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', textDecoration: 'underline' }}
          >
            Stop checking
          </button>
        )}
      </div>

      {/* 2. GRID WRAPPER WITH DIM SOLID BORDER & MESSAGE BUBBLE CORNER RADIUS */}
      <div
        style={{
          margin: 0,
          padding: 0,
          borderRadius: '24px 24px 24px 6px',
          border: '1px solid var(--bg-elevated)',
          background: 'transparent',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          
          {/* Cell 1: Vault */}
          <div
            onClick={onOpenVault}
            style={{
              padding: '1.35rem 1.15rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '120px',
              borderRight: '1px solid var(--bg-elevated)',
              borderBottom: '1px solid var(--bg-elevated)',
              background: 'transparent'
            }}
          >
            <LockClosedIcon style={{ width: '26px', height: '26px', color: 'var(--text-primary)' }} />
            <div>
              <div style={{ fontSize: '0.825rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.2rem', textTransform: 'uppercase' }}>
                VAULT
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                {incidentCount} Saved • PIN Locked
              </div>
            </div>
          </div>

          {/* Cell 2: Safety Timer */}
          <div
            onClick={onOpenSafetyTimer}
            style={{
              padding: '1.35rem 1.15rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '120px',
              borderBottom: '1px solid var(--bg-elevated)',
              background: 'transparent'
            }}
          >
            <ClockIcon style={{ width: '26px', height: '26px', color: 'var(--text-primary)' }} />
            <div>
              <div style={{ fontSize: '0.825rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.2rem', textTransform: 'uppercase' }}>
                SAFETY TIMER
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                15m / 30m Companion
              </div>
            </div>
          </div>

          {/* Cell 3: Ask Gemma */}
          <div
            onClick={onOpenChat}
            style={{
              padding: '1.35rem 1.15rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '120px',
              borderRight: '1px solid var(--bg-elevated)',
              background: 'transparent'
            }}
          >
            <ChatBubbleLeftRightIcon style={{ width: '26px', height: '26px', color: 'var(--text-primary)' }} />
            <div>
              <div style={{ fontSize: '0.825rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.2rem', textTransform: 'uppercase' }}>
                ASK GEMMA
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                Chat About Recordings
              </div>
            </div>
          </div>

          {/* Cell 4: Settings */}
          <div
            onClick={onOpenSettings}
            style={{
              padding: '1.35rem 1.15rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '120px',
              background: 'transparent'
            }}
          >
            <Cog6ToothIcon style={{ width: '26px', height: '26px', color: 'var(--text-primary)' }} />
            <div>
              <div style={{ fontSize: '0.825rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.2rem', textTransform: 'uppercase' }}>
                SETTINGS
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                Contacts & Vault PIN
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. MAP & HISTORY WRAPPER WITH SOLID FILL AT REDUCED OPACITY & NO BORDER */}
      <div
        style={{
          border: 'none',
          padding: '1.15rem 1.25rem',
          borderRadius: '24px 24px 6px 24px',
          background: 'rgba(250, 250, 252, 0.75)',
          backdropFilter: 'blur(8px)'
        }}
      >
        {/* Underlined Tab Header */}
        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--bg-elevated)', paddingBottom: '0.65rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setActiveBottomTab('map')}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: activeBottomTab === 'map' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              paddingBottom: '0.25rem',
              position: 'relative'
            }}
          >
            Map
            {activeBottomTab === 'map' && (
              <div style={{ position: 'absolute', bottom: '-0.7rem', left: 0, right: 0, height: '2px', background: 'var(--text-primary)', borderRadius: '2px' }} />
            )}
          </button>

          <button
            onClick={() => setActiveBottomTab('history')}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: activeBottomTab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              paddingBottom: '0.25rem',
              position: 'relative'
            }}
          >
            History
            {activeBottomTab === 'history' && (
              <div style={{ position: 'absolute', bottom: '-0.7rem', left: 0, right: 0, height: '2px', background: 'var(--text-primary)', borderRadius: '2px' }} />
            )}
          </button>
        </div>

        {/* Tab 1: Map Content */}
        {activeBottomTab === 'map' && (
          <div>
            <div
              onClick={onOpenMapModal}
              style={{ cursor: 'pointer', borderRadius: '16px', overflow: 'hidden', marginBottom: '0.75rem' }}
            >
              <IncidentMap height="140px" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>📍 Keffi-Abuja Corridor</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {defaultLat.toFixed(4)}° N, {defaultLng.toFixed(4)}° E
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: Live Audit Log Paper Trail Rows */}
        {activeBottomTab === 'history' && (
          <div>
            {auditLogs.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                No paper trail records yet. Trigger a recording to log system actions.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {auditLogs.slice(0, 4).map((log, idx) => {
                  const dateStr = new Date(log.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isKeep = log.status === 'keep' || log.final_decision === 'KEEP';

                  return (
                    <div
                      key={log.id || idx}
                      onClick={onOpenLogModal}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: '0.65rem',
                        borderBottom: idx < Math.min(auditLogs.length, 4) - 1 ? '1px solid var(--bg-elevated)' : 'none',
                        cursor: 'pointer',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '75%'
                        }}
                      >
                        • <strong style={{ fontWeight: 600 }}>{log.case_name || 'Event Investigation'}</strong> —{' '}
                        <span style={{ color: isKeep ? '#166534' : 'var(--text-secondary)' }}>
                          {isKeep ? 'KEEP' : 'QUIT'}
                        </span>
                      </div>

                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: '0.5rem' }}>
                        {dateStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: '0.85rem' }}>
              <button
                onClick={onOpenLogModal}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Expand Full History →
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REAL-TIME WEB AUDIO API FREQUENCY SPECTRUM WITH LERP PHYSICS
// ─────────────────────────────────────────────────────────────
function RealAudioWaveform({ isRecording, enginePhase }) {
  const [barHeights, setBarHeights] = useState(() => Array(28).fill(4));
  const currentHeightsRef = useRef(Array(28).fill(4));

  useEffect(() => {
    let animId = null;
    const numBars = 28;
    const freqBuffer = new Uint8Array(128);

    function updateWaveform() {
      const analyser = getAnalyserNode();
      if (analyser) {
        analyser.getByteFrequencyData(freqBuffer);
      }

      const nextHeights = [];
      const now = Date.now();

      for (let i = 0; i < numBars; i++) {
        let targetH = 4;
        if (analyser) {
          // Map index across low (bass), mid (vocal), and high (scream) frequency bins
          const binIdx = Math.floor((i / numBars) * (freqBuffer.length * 0.65));
          const val = freqBuffer[binIdx] / 255;
          targetH = Math.max(4, Math.floor(val * 32));
        } else {
          // Gentle resting breathing curve if mic analyser is initializing
          targetH = Math.max(4, Math.floor(Math.sin((i * 0.4) + (now / 350)) * 5 + 8));
        }

        // Lerp physics: smoothly interpolate current height towards target height
        const current = currentHeightsRef.current[i] || 4;
        const lerped = current + (targetH - current) * 0.28;
        currentHeightsRef.current[i] = lerped;
        nextHeights.push(Math.round(lerped));
      }

      setBarHeights(nextHeights);
      animId = requestAnimationFrame(updateWaveform);
    }

    animId = requestAnimationFrame(updateWaveform);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  const barColor = enginePhase === 'LONG_TERM' ? '#0d9488' : isRecording ? '#d97706' : 'var(--text-primary)';

  return (
    <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', margin: '0.5rem 0' }}>
      {barHeights.map((h, i) => (
        <div
          key={i}
          style={{
            width: '3px',
            height: `${h}px`,
            background: barColor,
            opacity: isRecording ? 1 : 0.4 + (i % 4) * 0.15,
            borderRadius: '2px',
            transition: 'height 0.04s linear'
          }}
        />
      ))}
    </div>
  );
}
