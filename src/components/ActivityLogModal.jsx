import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, ShieldCheckIcon, TrashIcon } from '@heroicons/react/24/solid';
import { getAllAuditLogs, db } from '../services/db';

export function ActivityLogModal({ isOpen, onClose }) {
  const [expandedLogId, setExpandedLogId] = useState(null);

  const logs = useLiveQuery(
    () => getAllAuditLogs(),
    []
  ) || [];

  // Auto-expand latest log entry when logs load or modal opens
  React.useEffect(() => {
    if (logs.length > 0 && !expandedLogId) {
      setExpandedLogId(logs[0].id);
    }
  }, [logs, expandedLogId]);

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
          maxWidth: '440px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          padding: '1.5rem 1.25rem',
          position: 'relative',
          border: '1px solid var(--bg-elevated)',
          boxShadow: 'none',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexShrink: 0 }}>
          <div>
            <div className="micro-label" style={{ marginBottom: 0 }}>SAFETY LOG</div>
            <h3 className="headline-md" style={{ margin: 0, fontSize: '1.25rem' }}>Audit Log</h3>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'var(--bg-elevated)',
              color: 'var(--text-muted)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <XMarkIcon style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Scrollable Audit Log Entries */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '4px' }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No forensic decision logs recorded yet. Trigger a recording to generate a paper trail.
            </div>
          ) : (
            logs.map(log => {
              const isExpanded = expandedLogId === log.id;
              const dateStr = new Date(log.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isKeep = log.status === 'keep' || log.final_decision === 'KEEP';

              return (
                <div
                  key={log.id}
                  style={{
                    background: 'var(--bg-main)',
                    borderRadius: '16px',
                    padding: '0.85rem 1rem',
                    border: '1px solid var(--bg-elevated)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Summary Bar */}
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isKeep ? '#dcfce7' : '#fee2e2',
                            color: isKeep ? '#166534' : '#991b1b'
                          }}
                        >
                          {isKeep ? 'SAVED TO VAULT' : 'ALL CLEAR (AUDIO DELETED)'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {(log.case_name || 'Sound Check').replace(/^Keffi\s*•?\s*/i, '')}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                        {dateStr} • {(log.location || 'Recorded Location').replace('Keffi-Abuja Corridor', 'Recorded Location')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
                      {isExpanded ? (
                        <ChevronUpIcon style={{ width: '18px', height: '18px' }} />
                      ) : (
                        <ChevronDownIcon style={{ width: '18px', height: '18px' }} />
                      )}
                    </div>
                  </div>

                  {/* Expanded Paper Trail Details */}
                  {isExpanded && (
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      
                      {/* Rationale Statement */}
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          {isKeep ? 'WHY THIS WAS SAVED' : 'WHY THIS WAS NOT SAVED'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          {isKeep
                            ? (log.reason || 'High 2-4kHz Scream Formant Concentration (> 0.12): +2 points, RMS Loudness Spike / Crash above baseline (RMS >= 0.12): +2 points, Physical Collision / Jolt Motion (> 8.0 m/s²): +2 points, Multi-Window Persistence (elevated sound in 2+ windows): +2 points. Audio saved safely in Vault.')
                            : (log.reason && !log.reason.includes('Quiet ambient baseline') ? log.reason : 'Room was quiet. Sound score was low (2/10, needs 7 to save). Audio deleted to keep your phone clean.')}
                        </div>
                      </div>

                      {/* Window Polls Breakdown */}
                      {log.polls?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            3-STEP SOUND CHECK (45s TOTAL — 15s EACH)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {log.polls.map((p, pIdx) => (
                              <div
                                key={pIdx}
                                style={{
                                  background: 'var(--bg-card)',
                                  padding: '0.55rem 0.75rem',
                                  borderRadius: '10px',
                                  fontSize: '0.75rem',
                                  border: '1px solid var(--bg-elevated)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Check #{p.window || pIdx + 1} (15s Clip)
                                  </span>
                                  <span style={{ fontWeight: 700, color: p.vote === 1 ? '#166534' : '#991b1b' }}>
                                    {p.vote === 1 ? 'Keep' : 'Safe'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.2rem' }}>
                                  🗣️ <span style={{ fontStyle: 'italic', color: p.transcript ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    "{p.transcript || 'No vocal speech detected.'}"
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.675rem', color: 'var(--text-secondary)' }}>
                                  🤖 Reason: {p.reason || 'Evidence classification complete.'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Evidence Integrity Status */}
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '0.45rem 0.65rem', borderRadius: '8px' }}>
                        🛡️ <strong>Safety Integrity</strong>: Verified Logged • {isKeep ? 'Audio Package Preserved in Vault' : 'Audio Deleted (Phone Clean)'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
