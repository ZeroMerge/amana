import React, { useEffect, useState } from 'react';
import { Radio, RefreshCw, Smartphone, Zap, Sliders, Cpu } from 'lucide-react';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { getLatestMotionData } from '../services/motionEngine';

export function MonitorView({
  isMonitoring,
  onToggleMonitoring,
  currentFeatures,
  calibrationData,
  onRecalibrate,
  onManualTrigger,
  onManualStop,
  enginePhase = 'IDLE',
  activeIncident = null
}) {
  const [motionData, setMotionData] = useState({ mag: 0, isSpike: false });
  const [wakeLockActive, setWakeLockActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isMonitoring) {
      interval = setInterval(() => {
        setMotionData(getLatestMotionData());
      }, 100);

      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen')
          .then(() => setWakeLockActive(true))
          .catch(err => console.log('Wake Lock error:', err));
      }
    } else {
      setWakeLockActive(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring]);

  const isConditionMet = currentFeatures && calibrationData &&
    (currentFeatures.rms > calibrationData.threshold_rms &&
     currentFeatures.band_2k_4k_energy > calibrationData.threshold_2k4k);

  const getPhaseBadge = (phase) => {
    switch (phase) {
      case 'TRIGGERED':
        return { label: 'Capturing 15s Window', color: '#E53E3E', bg: '#FED7D7' };
      case 'DECIDING':
        return { label: 'Gemma 4 Decision Loop', color: '#2B6CB0', bg: '#EBF8FF' };
      case 'LONG_TERM':
        return { label: 'Adaptive Collection', color: '#975A16', bg: '#FEFCBF' };
      case 'CLOSING':
        return { label: 'Hashing & Preserving', color: '#38A169', bg: '#C6F6D5' };
      default:
        return { label: isMonitoring ? 'Passive Listening' : 'Paused', color: '#4A6FA5', bg: '#F0F4F8' };
    }
  };

  const badge = getPhaseBadge(enginePhase);
  const isAcquisitionActive = ['TRIGGERED', 'DECIDING', 'LONG_TERM'].includes(enginePhase);

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* Monitoring Status & Phase Card */}
      <div className="card" style={{ borderLeft: enginePhase !== 'IDLE' ? '4px solid #E53E3E' : '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: enginePhase !== 'IDLE' ? '#E53E3E' : isMonitoring ? '#38A169' : '#CBD5E1',
              boxShadow: isMonitoring ? `0 0 8px ${enginePhase !== 'IDLE' ? '#E53E3E' : '#38A169'}` : 'none'
            }} />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {enginePhase !== 'IDLE' ? `Incident Active — Phase: ${enginePhase}` : isMonitoring ? 'Passive Monitoring Active' : 'Monitoring Paused'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                {wakeLockActive ? 'Screen Wake Lock Engaged' : 'Tap pause/resume to toggle'}
              </div>
            </div>
          </div>

          <span className="package-badge" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        </div>

        {/* Active Incident Adaptive Loop Status Banner */}
        {activeIncident && (
          <div style={{ marginTop: '0.65rem', background: '#F8FAFC', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#2B6CB0', fontWeight: 600, marginBottom: '0.2rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Cpu size={14} /> Adaptive Acquisition Loop
              </span>
              <span>Window #{activeIncident.ledger?.collection_window || 1} of 6</span>
            </div>

            <div style={{ color: '#334155', fontSize: '0.75rem' }}>
              Elapsed Time: <strong>{activeIncident.ledger?.elapsed_seconds || 15}s</strong>
            </div>

            {activeIncident.ledger?.last_gemma_response?.observation && (
              <div style={{ fontStyle: 'italic', color: '#4A6FA5', marginTop: '0.3rem', background: '#F0F4F8', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                "{activeIncident.ledger.last_gemma_response.observation}"
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn-secondary"
            onClick={onToggleMonitoring}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {isMonitoring ? 'Pause Passive Monitoring' : 'Resume Passive Monitoring'}
          </button>

          {isAcquisitionActive && (
            <button
              className="btn-danger"
              onClick={onManualStop}
              style={{ flexShrink: 0, padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
            >
              Stop Acquisition
            </button>
          )}
        </div>
      </div>

      {/* Live Audio Visualizer */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Radio size={16} color="#4A6FA5" /> Live Signal Analysis
          </div>

          <span className={`package-badge ${isConditionMet ? 'badge-high' : ''}`}>
            {isConditionMet ? 'Spike Detected' : 'Normal'}
          </span>
        </div>

        <AudioVisualizer
          features={currentFeatures}
          thresholdRms={calibrationData?.threshold_rms || 0.20}
          isConditionMet={isConditionMet}
        />

        {/* Live Audio Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.75rem', textAlign: 'center' }}>
          <div style={{ background: '#F0F2F5', padding: '0.4rem', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>RMS</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {currentFeatures?.rms ? currentFeatures.rms.toFixed(2) : '0.00'}
            </div>
          </div>

          <div style={{ background: '#F0F2F5', padding: '0.4rem', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>2-4kHz</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {currentFeatures?.band_2k_4k_energy ? currentFeatures.band_2k_4k_energy.toFixed(2) : '0.00'}
            </div>
          </div>

          <div style={{ background: '#F0F2F5', padding: '0.4rem', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Centroid</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {currentFeatures?.spectral_centroid ? `${currentFeatures.spectral_centroid}Hz` : '0Hz'}
            </div>
          </div>

          <div style={{ background: '#F0F2F5', padding: '0.4rem', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>ZCR</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {currentFeatures?.zero_crossing_rate ? currentFeatures.zero_crossing_rate : '0.00'}
            </div>
          </div>
        </div>
      </div>

      {/* Motion Sensor Card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Smartphone size={20} color={motionData.isSpike ? '#E53E3E' : '#4A6FA5'} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Accelerometer Sensor</div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Magnitude: {motionData.mag} m/s² (Threshold: 15.0 m/s²)
            </div>
          </div>
        </div>

        <span className={`package-badge ${motionData.isSpike ? 'badge-high' : ''}`}>
          {motionData.isSpike ? 'Jolt' : 'Steady'}
        </span>
      </div>

      {/* Calibration Baseline Stats */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sliders size={16} color="#4A6FA5" /> Adaptive Threshold Baseline
          </div>

          <button className="btn-secondary" onClick={onRecalibrate} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
            <RefreshCw size={12} style={{ marginRight: '4px' }} /> Recalibrate
          </button>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#64748B', lineHeight: 1.5 }}>
          <div>Ambient RMS Baseline: <strong>{calibrationData?.ambient_rms || '0.00'}</strong></div>
          <div>Ambient 2–4kHz Baseline: <strong>{calibrationData?.ambient_2k4k || '0.00'}</strong></div>
          <div>Calculated RMS Threshold: <strong>{calibrationData?.threshold_rms || '0.20'}</strong></div>
          <div>Calculated 2–4kHz Threshold: <strong>{calibrationData?.threshold_2k4k || '0.15'}</strong></div>
        </div>
      </div>

      {/* Test Trigger Button */}
      <div className="card" style={{ textAlign: 'center', background: '#F8FAFC' }}>
        <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '0.65rem' }}>
          Hackathon Quick Test: Simulate immediate sound/motion trigger to launch the adaptive decision loop.
        </div>

        <button className="btn-secondary" onClick={onManualTrigger} style={{ width: '100%', justifyContent: 'center' }}>
          <Zap size={16} color="#E53E3E" style={{ marginRight: '6px' }} />
          Simulate Adaptive Trigger Loop
        </button>
      </div>
    </div>
  );
}
