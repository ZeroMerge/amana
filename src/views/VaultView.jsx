import React, { useState, useRef, useEffect } from 'react';
import {
  LockClosedIcon,
  Squares2X2Icon,
  ListBulletIcon,
  TrashIcon,
  BackspaceIcon,
  PlayIcon,
  PauseIcon,
  ChatBubbleLeftRightIcon,
  ArrowLeftIcon,
  MapPinIcon
} from '@heroicons/react/24/solid';
import { IncidentMap } from '../components/IncidentMap';
import { getPermanentRecNumber, getSegmentsForIncident, generateUniqueCaseName } from '../services/db';
import { generateGemmaReportOnDemand } from '../services/incidentEngine';

export function VaultView({
  incidents = [],
  isVaultUnlocked,
  onUnlockVault,
  onOpenChatWithIncident,
  onDeleteIncident
}) {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  // Real Segments & Report State from Dexie
  const [segments, setSegments] = useState([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [customReport, setCustomReport] = useState(null);

  // Real Audio Playback & Part Selection State
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(15);

  // Location Sub-Tab State
  const [locationTab, setLocationTab] = useState('map');

  const audioRef = useRef(null);

  // Fetch real segments from Dexie when an incident is selected
  useEffect(() => {
    if (!selectedIncident) {
      setSegments([]);
      return;
    }
    setSegmentsLoading(true);
    setActivePartIndex(0);
    setAudioProgress(0);
    setIsPlayingAudio(false);
    getSegmentsForIncident(selectedIncident.id)
      .then(segs => setSegments(segs || []))
      .catch(() => setSegments([]))
      .finally(() => setSegmentsLoading(false));
  }, [selectedIncident]);

  // Real Audio Element Lifecycle — driven by activePartIndex & real segments
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setCurrentTimeSec(0);
    setDurationSec(15);

    if (!selectedIncident) return;

    // Pick the right audio blob from real segments, or fall back to demo
    const activeSeg = segments[activePartIndex];
    let audioUrl = null;
    let isBlob = false;

    if (activeSeg?.audio_blob) {
      try {
        audioUrl = URL.createObjectURL(activeSeg.audio_blob);
        isBlob = true;
      } catch (err) {
        console.warn('Could not create ObjectURL for segment blob:', err);
      }
    }

    // Only use demo file if there truly are no segments at all
    if (!audioUrl && segments.length === 0) {
      audioUrl = '/demo_sample.mp3';
    }

    if (!audioUrl) return; // segment exists but blob missing — skip loading

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDurationSec(Math.round(audio.duration));
      }
    };

    audio.ontimeupdate = () => {
      if (audio.duration) {
        const cur = audio.currentTime;
        const dur = audio.duration;
        setCurrentTimeSec(Math.round(cur));
        setAudioProgress((cur / dur) * 100);
      }
    };

    audio.onended = () => {
      setIsPlayingAudio(false);
      setAudioProgress(0);
      setCurrentTimeSec(0);
    };

    return () => {
      audio.pause();
      if (isBlob && audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      audioRef.current = null;
    };
  }, [selectedIncident, activePartIndex, segments]);

  // Play / Pause Toggle
  const togglePlayAudio = () => {
    const audio = audioRef.current;
    if (!audio) {
      setIsPlayingAudio(!isPlayingAudio);
      return;
    }

    if (isPlayingAudio) {
      audio.pause();
      setIsPlayingAudio(false);
    } else {
      audio.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(err => {
        console.warn('Audio play request interrupted:', err);
        setIsPlayingAudio(true);
      });
    }
  };

  // Fluid Scrubber Animation fallback (when no real duration available)
  useEffect(() => {
    let interval;
    if (isPlayingAudio && !audioRef.current?.duration) {
      interval = setInterval(() => {
        setAudioProgress(prev => {
          if (prev >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 1.5;
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  // Keypad Handlers
  const handleNumClick = (num) => {
    if (pinInput.length < 4) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);
      setPinError(false);

      if (nextPin.length === 4) {
        const storedPin = localStorage.getItem('amana_vault_pin') || '1234';
        if (nextPin === storedPin) {
          onUnlockVault();
          setPinInput('');
        } else {
          setPinError(true);
          setTimeout(() => {
            setPinInput('');
            setPinError(false);
          }, 800);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
    setPinError(false);
  };

  // Locked State Screen
  if (!isVaultUnlocked) {
    return (
      <div className="card-flat" style={{ textAlign: 'center', padding: '2rem 1.25rem', border: 'none' }}>
        <div style={{ margin: '0 auto 1.25rem', width: '56px', height: '56px', background: 'var(--bg-elevated)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LockClosedIcon style={{ width: '28px', height: '28px', color: 'var(--text-primary)' }} />
        </div>

        <h2 className="headline-lg" style={{ marginBottom: '0.4rem' }}>
          Enter Vault PIN
        </h2>
        <p className="body-sm" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          Enter your 4-digit PIN to access saved recordings.
        </p>

        {/* PIN Dot Indicators */}
        <div className="pin-dots" style={{ margin: '1.25rem 0 1.5rem' }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`pin-dot ${i < pinInput.length ? 'filled' : ''}`}
              style={{ border: pinError ? '2px solid #dc2626' : 'none' }}
            />
          ))}
        </div>

        {pinError && (
          <div style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '1rem', fontWeight: 500 }}>
            Incorrect PIN. Try default (1234).
          </div>
        )}

        {/* Circular PIN Keypad Grid */}
        <div className="pin-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button key={num} className="pin-key" onClick={() => handleNumClick(num)} style={{ border: 'none' }}>
              {num}
            </button>
          ))}
          <div />
          <button className="pin-key" onClick={() => handleNumClick('0')} style={{ border: 'none' }}>0</button>
          <button className="pin-key" onClick={handleBackspace} style={{ border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BackspaceIcon style={{ width: '22px', height: '22px', color: 'var(--text-primary)' }} />
          </button>
        </div>
      </div>
    );
  }

  // DEDICATED SAVED RECORDING PAGE VIEW
  if (selectedIncident) {
    const activeReport = selectedIncident.final_report;
    const incIndex = incidents.findIndex(i => i.id === selectedIncident.id);
    const permNumber = getPermanentRecNumber(selectedIncident, incIndex !== -1 ? incIndex : 0, incidents.length);
    const dateStr = new Date(selectedIncident.started_at || Date.now()).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Build real audio parts from fetched Dexie segments
    const audioParts = segments.length > 0
      ? segments.map((seg, idx) => ({
          id: seg.id,
          name: `Part ${seg.segment_number || idx + 1}`,
          duration: seg.duration_ms ? `${Math.round(seg.duration_ms / 1000)}s` : '15s',
          time: new Date(seg.recorded_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          hasBlob: !!seg.audio_blob
        }))
      : [{ id: 'demo', name: 'Part 1', duration: '15s', time: dateStr, hasBlob: false }];

    // GPS location from trail or fallback
    const gpsStart = selectedIncident.gps_trail?.[0];
    const gpsEnd = selectedIncident.gps_trail?.[selectedIncident.gps_trail.length - 1] || gpsStart;
    const locationLabel = gpsStart
      ? `${gpsStart.lat?.toFixed(4) || '8.8471'}° N, ${gpsStart.lng?.toFixed(4) || '7.8736'}° E`
      : 'Keffi-Abuja Corridor';

    return (
      <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* Top Header & Back Button */}
        <div>
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.pause();
              setIsPlayingAudio(false);
              setAudioProgress(0);
              setSelectedIncident(null);
              setSegments([]);
            }}
            title="Back to Vault"
            style={{
              border: 'none',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginBottom: '1.25rem',
              padding: 0
            }}
          >
            <ArrowLeftIcon style={{ width: '18px', height: '18px' }} />
          </button>

          <div className="micro-label" style={{ marginBottom: '0.2rem' }}>SAVED RECORDING</div>
          <h2 className="headline-md" style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>
            Saved Recording #{permNumber}
          </h2>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
            {dateStr} • {locationLabel}
          </div>
        </div>

        {/* 1. REAL AUDIO CLIPS SECTION */}
        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--bg-elevated)' }}>
          <div className="micro-label" style={{ marginBottom: '0.65rem' }}>
            AUDIO CLIPS {segmentsLoading ? '(loading...)' : `(${audioParts.length})`}
          </div>

          {/* Real Segment Part Selector */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {audioParts.map((part, pIdx) => (
              <button
                key={part.id}
                onClick={() => {
                  if (audioRef.current) audioRef.current.pause();
                  setActivePartIndex(pIdx);
                  setAudioProgress(0);
                  setIsPlayingAudio(false);
                }}
                style={{
                  border: 'none',
                  background: activePartIndex === pIdx ? 'var(--text-primary)' : 'var(--bg-elevated)',
                  color: activePartIndex === pIdx ? 'var(--bg-card)' : 'var(--text-primary)',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  opacity: part.hasBlob === false && segments.length > 0 ? 0.5 : 1
                }}
              >
                <span>{part.name}</span>
                <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>({part.duration})</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {audioParts[activePartIndex]?.name} — {audioParts[activePartIndex]?.duration}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {isPlayingAudio
                  ? `Playing: ${currentTimeSec}s / ${durationSec}s`
                  : `Recorded at ${audioParts[activePartIndex]?.time}`}
              </div>
            </div>

            <button
              onClick={togglePlayAudio}
              style={{ border: 'none', background: 'var(--bg-card)', width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              {isPlayingAudio ? (
                <PauseIcon style={{ width: '22px', height: '22px', color: 'var(--text-primary)' }} />
              ) : (
                <PlayIcon style={{ width: '22px', height: '22px', color: 'var(--text-primary)', marginLeft: '2px' }} />
              )}
            </button>
          </div>

          {/* Soundwave Scrubber Track */}
          <div style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '3px', margin: '0.5rem 0' }}>
            {Array.from({ length: 36 }).map((_, i) => {
              const isActive = (i / 36) * 100 <= audioProgress;
              const dynamicHeight = isPlayingAudio && isActive
                ? Math.floor(Math.sin((i + Date.now() / 120) * 0.4) * 12 + 20)
                : Math.floor(Math.sin(i * 0.5) * 8 + 10);

              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${dynamicHeight}px`,
                    background: 'var(--text-primary)',
                    opacity: isActive ? 1 : 0.25,
                    borderRadius: '3px',
                    transition: isPlayingAudio ? 'height 0.08s ease' : 'height 0.2s ease'
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* 2. LOCATION & ROUTE SECTION */}
        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--bg-elevated)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div className="micro-label" style={{ marginBottom: 0 }}>LOCATION & ROUTE</div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setLocationTab('map')}
                style={{
                  border: 'none', background: 'transparent', fontSize: '0.775rem', fontWeight: 600,
                  color: locationTab === 'map' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer',
                  paddingBottom: '4px', borderBottom: locationTab === 'map' ? '2px solid var(--text-primary)' : '2px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                Map
              </button>
              <button
                onClick={() => setLocationTab('journey')}
                style={{
                  border: 'none', background: 'transparent', fontSize: '0.775rem', fontWeight: 600,
                  color: locationTab === 'journey' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer',
                  paddingBottom: '4px', borderBottom: locationTab === 'journey' ? '2px solid var(--text-primary)' : '2px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                Trip Path
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', minHeight: '200px', transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            {/* Map View */}
            <div style={{
              position: 'absolute', inset: 0,
              opacity: locationTab === 'map' ? 1 : 0,
              transform: locationTab === 'map' ? 'translateX(0px) scale(1)' : 'translateX(-12px) scale(0.98)',
              pointerEvents: locationTab === 'map' ? 'auto' : 'none',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <div style={{ borderRadius: '18px', overflow: 'hidden', marginBottom: '0.65rem' }}>
                <IncidentMap height="160px" gpsTrail={selectedIncident.gps_trail || []} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <MapPinIcon style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }} />
                <span>{locationLabel}</span>
              </div>
            </div>

            {/* Trip Path View */}
            <div style={{
              position: 'absolute', inset: 0,
              opacity: locationTab === 'journey' ? 1 : 0,
              transform: locationTab === 'journey' ? 'translateX(0px) scale(1)' : 'translateX(12px) scale(0.98)',
              pointerEvents: locationTab === 'journey' ? 'auto' : 'none',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <div style={{ background: 'var(--bg-card)', padding: '1.25rem 1rem', borderRadius: '18px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '12px', bottom: '12px', left: '7px', width: '2px', background: 'var(--bg-elevated)' }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', zIndex: 1 }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#16a34a', border: '3px solid var(--bg-card)', marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Start</div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                        {dateStr} •{' '}
                        {gpsStart ? `${gpsStart.lat?.toFixed(4)}° N, ${gpsStart.lng?.toFixed(4)}° E` : locationLabel}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', zIndex: 1 }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#dc2626', border: '3px solid var(--bg-card)', marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Last Known Position</div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                        {new Date(selectedIncident.ended_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} •{' '}
                        {gpsEnd ? `${gpsEnd.lat?.toFixed(4)}° N, ${gpsEnd.lng?.toFixed(4)}° E` : locationLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Gemma Written Summary & Investigation Report Section */}
        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--bg-elevated)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div className="micro-label" style={{ marginBottom: 0 }}>GEMMA WRITTEN SUMMARY</div>
            {(activeReport?.threat_level || customReport?.threat_level) && (
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: (activeReport?.threat_level === 'High' || activeReport?.threat_level === 'Critical') ? '#fee2e2' : '#dcfce7',
                color: (activeReport?.threat_level === 'High' || activeReport?.threat_level === 'Critical') ? '#991b1b' : '#166534'
              }}>
                Threat Level: {activeReport?.threat_level || customReport?.threat_level || 'Normal'}
              </span>
            )}
          </div>

          <p className="body-sm" style={{ color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.65, marginBottom: '0.75rem' }}>
            {(customReport || activeReport)?.narrative ||
             (customReport || activeReport)?.summary ||
             selectedIncident.ledger?.narrative ||
             selectedIncident.ledger?.summary ||
             `${audioParts.length} audio clip${audioParts.length !== 1 ? 's' : ''} saved safely. Gemma auto-generates a forensic report 30 mins post-recording.`}
          </p>

          {/* Timeline Milestones if Report Exists */}
          {(customReport || activeReport)?.timeline?.length > 0 && (
            <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '10px', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>EVIDENCE TIMELINE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {(customReport || activeReport).timeline.map((item, tIdx) => (
                  <div key={tIdx} style={{ fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{item.time}</span>
                    <span>{item.event}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual "Generate Report Now" Button if no report generated yet */}
          {!activeReport && !customReport && (
            <button
              onClick={async () => {
                setIsGeneratingReport(true);
                const rep = await generateGemmaReportOnDemand(selectedIncident.id);
                if (rep) setCustomReport(rep);
                setIsGeneratingReport(false);
              }}
              disabled={isGeneratingReport}
              style={{
                border: 'none',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: isGeneratingReport ? 0.6 : 1
              }}
            >
              {isGeneratingReport ? 'Gemma is analyzing audio clips...' : '⚡ Generate AI Forensic Report Now (Skip 30m Wait)'}
            </button>
          )}
        </div>

        {/* 4. Action Buttons */}
        <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--bg-elevated)', display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <button
            onClick={() => onOpenChatWithIncident(selectedIncident.id)}
            className="btn-primary-dark"
            style={{ flex: 1, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.85rem' }}
          >
            <ChatBubbleLeftRightIcon style={{ width: '18px', height: '18px' }} />
            <span>Ask Gemma About This Recording</span>
          </button>

          <button
            onClick={async () => {
              if (audioRef.current) audioRef.current.pause();
              await onDeleteIncident(selectedIncident.id);
              setSelectedIncident(null);
              setSegments([]);
            }}
            style={{ border: 'none', background: '#fee2e2', color: '#dc2626', padding: '0.85rem 1.15rem', borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <TrashIcon style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

      </div>
    );
  }

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* Vault Header with View Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div className="micro-label" style={{ marginBottom: 0 }}>SAVED VAULT</div>
          <h2 className="headline-md" style={{ margin: 0 }}>
            Saved Events ({incidents.length})
          </h2>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid View"
            style={{
              border: 'none',
              background: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
              color: 'var(--text-primary)',
              padding: '0.35rem', borderRadius: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: viewMode === 'grid' ? 1 : 0.4, transition: 'all 0.2s ease'
            }}
          >
            <Squares2X2Icon style={{ width: '16px', height: '16px' }} />
          </button>

          <button
            onClick={() => setViewMode('list')}
            title="List View"
            style={{
              border: 'none',
              background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
              color: 'var(--text-primary)',
              padding: '0.35rem', borderRadius: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: viewMode === 'list' ? 1 : 0.4, transition: 'all 0.2s ease'
            }}
          >
            <ListBulletIcon style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>

      {/* Empty State */}
      {incidents.length === 0 ? (
        <div className="card-flat" style={{ border: 'none', textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--bg-card)', borderRadius: '24px' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            No saved recordings in Vault yet.
          </div>
        </div>
      ) : (
        <>
          {/* GRID VIEW */}
          {viewMode === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {incidents.map((inc, index) => {
                const permNum = getPermanentRecNumber(inc, index, incidents.length);
                const dateStr = new Date(inc.started_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const segCount = inc.ledger?.gemma_call_count || '?';

                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    style={{ position: 'relative', marginTop: '12px', cursor: 'pointer' }}
                  >
                    <div style={{
                      position: 'absolute', top: '-12px', left: 0, width: '80px', height: '14px',
                      background: 'var(--bg-card)', borderTop: '1px solid var(--bg-elevated)',
                      borderLeft: '1px solid var(--bg-elevated)', borderRight: '1px solid var(--bg-elevated)',
                      borderRadius: '10px 10px 0 0'
                    }} />

                    <div style={{
                      background: 'var(--bg-card)', border: '1px solid var(--bg-elevated)',
                      borderRadius: '0 16px 16px 16px', padding: '1.15rem 1rem',
                      minHeight: '115px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {inc.case_name || generateUniqueCaseName(inc.gps_trail?.[0]?.place, inc.trigger_type, permNum)}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                          {inc.gps_trail?.[0]
                            ? `${inc.gps_trail[0].lat?.toFixed(3)}° N, ${inc.gps_trail[0].lng?.toFixed(3)}° E`
                            : 'Keffi-Abuja Corridor'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>
                        <span>{dateStr}</span>
                        <span>{typeof segCount === 'number' ? `${segCount * 15}s` : '30s'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {incidents.map((inc, index) => {
                const permNum = getPermanentRecNumber(inc, index, incidents.length);
                const dateStr = new Date(inc.started_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const segCount = inc.ledger?.gemma_call_count || 2;
                const caseTitle = inc.case_name || generateUniqueCaseName(inc.gps_trail?.[0]?.place, inc.trigger_type, permNum);

                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    style={{
                      background: 'var(--bg-card)', border: 'none', padding: '0.85rem 1rem',
                      borderRadius: '14px', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                      • <strong style={{ fontWeight: 600 }}>{caseTitle}</strong>
                    </div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {dateStr} • {segCount * 15}s
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
