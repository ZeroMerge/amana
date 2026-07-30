import React from 'react';
import { ShieldCheck, Mic, Activity, Lock, ArrowRight, Cpu } from 'lucide-react';

export function LandingView({ onStart }) {
  return (
    <div style={{ padding: '1.25rem 0' }}>
      <div className="card" style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
        <div style={{ margin: '0 auto 1rem', width: '56px', height: '56px', background: '#F0F2F5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={32} color="#4A6FA5" />
        </div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1A1A1A', marginBottom: '0.5rem' }}>
          Amana
        </h1>

        <p style={{ fontSize: '0.9rem', color: '#4A6FA5', fontWeight: 500, marginBottom: '1.25rem' }}>
          Adaptive Evidence Acquisition System
        </p>

        <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 1.5rem' }}>
          A recorder captures everything. Amana decides, repeatedly, whether another piece of evidence is worth collecting.
          Edge classifiers detect distress signatures, while Gemma reasons iteratively over accumulated multimodal evidence.
        </p>

        <button className="btn-primary" onClick={onStart}>
          <span>Start Passive Monitoring</span>
          <ArrowRight size={18} style={{ marginLeft: '8px' }} />
        </button>
      </div>

      {/* Concept Architecture Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
        <div className="card" style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', margin: 0 }}>
          <Mic size={20} color="#4A6FA5" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem' }}>1. Edge Classifiers Detect</h4>
            <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.4 }}>
              Lightweight Web Audio FFT + accelerometer sensors run continuously at zero battery cost to detect initial distress signatures.
            </p>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', margin: 0 }}>
          <Cpu size={20} color="#4A6FA5" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem' }}>2. Gemma Iterative Decision Loop</h4>
            <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.4 }}>
              Multimodal Gemma receives 15s audio + sensor snapshots + evolving ledger to decide: <em>continue</em>, <em>observe_again</em>, or <em>stop</em>.
            </p>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', margin: 0 }}>
          <Lock size={20} color="#4A6FA5" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem' }}>3. Offline Evidence Preservation</h4>
            <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.4 }}>
              All audio clips, SHA-256 hashes, and GPS trails are preserved locally in IndexedDB for post-incident investigation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
