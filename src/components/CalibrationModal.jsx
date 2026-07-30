import React from 'react';
import { Mic, Activity } from 'lucide-react';

export function CalibrationModal({ progress, currentFeatures, onCancel }) {
  const percent = Math.round(progress * 100);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ padding: '0.5rem', background: '#F0F2F5', borderRadius: '50%' }}>
            <Mic size={24} color="#4A6FA5" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Calibrating Ambient Noise</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B' }}>Hold phone naturally in your environment</p>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#1A1A1A', lineHeight: 1.5 }}>
          Measuring 15 seconds of ambient sound to set adaptive detection thresholds...
        </p>

        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748B' }}>
          <span>{percent}% Complete</span>
          <span>{Math.max(0, Math.ceil(15 * (1 - progress)))}s remaining</span>
        </div>

        {currentFeatures && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#F0F2F5', borderRadius: '6px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4A6FA5', fontWeight: 600 }}>
              <Activity size={14} /> Live Features
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.4rem' }}>
              <div>RMS: <strong>{currentFeatures.rms?.toFixed(3)}</strong></div>
              <div>2-4kHz: <strong>{currentFeatures.band_2k_4k_energy?.toFixed(3)}</strong></div>
              <div>Centroid: <strong>{currentFeatures.spectral_centroid}Hz</strong></div>
              <div>ZCR: <strong>{currentFeatures.zero_crossing_rate}</strong></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
