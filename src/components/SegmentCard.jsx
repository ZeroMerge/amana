import React, { useState, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  CpuChipIcon,
  ClipboardDocumentIcon,
  CheckIcon
} from '@heroicons/react/24/solid';

export function SegmentCard({ segment, index }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElem, setAudioElem] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (segment.audio_blob) {
      const url = URL.createObjectURL(segment.audio_blob);
      setAudioUrl(url);
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      setAudioElem(audio);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [segment.audio_blob]);

  const togglePlay = () => {
    if (!audioElem) return;
    if (isPlaying) {
      audioElem.pause();
      setIsPlaying(false);
    } else {
      audioElem.play();
      setIsPlaying(true);
    }
  };

  const copyHash = () => {
    if (segment.local_hash) {
      navigator.clipboard.writeText(segment.local_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const decision = segment.gemma_decision?.decision || 'observe_again';
  const source = segment.gemma_decision?._source || 'local_fallback';

  return (
    <div className="card-flat" style={{ marginBottom: '0.65rem', background: 'var(--bg-elevated)', border: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
          Segment #{segment.segment_number || index + 1} (15s Window)
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <span className="badge-mono">{source === 'gemma_cloud' ? 'Gemma 4' : 'Fallback'}</span>
          <span className="badge-mono">{decision}</span>
        </div>
      </div>

      {audioUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-card)', padding: '0.5rem 0.75rem', borderRadius: '12px', margin: '0.5rem 0', border: 'none' }}>
          <button
            onClick={togglePlay}
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--text-primary)', color: 'var(--bg-main)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            {isPlaying ? <PauseIcon style={{ width: '14px', height: '14px' }} /> : <PlayIcon style={{ width: '14px', height: '14px', marginLeft: '2px' }} />}
          </button>
          <div style={{ fontSize: '0.75rem', flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Audio Recording</div>
            <div style={{ color: 'var(--text-muted)' }}>RMS: {segment.audio_features?.peak_rms?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', border: 'none' }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>SHA-256: {segment.local_hash?.slice(0, 20)}...</span>
        <button onClick={copyHash} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          {copied ? <CheckIcon style={{ width: '14px', height: '14px', color: '#16a34a' }} /> : <ClipboardDocumentIcon style={{ width: '14px', height: '14px' }} />}
        </button>
      </div>

      {segment.gemma_decision?.observation && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-card)', padding: '0.4rem 0.65rem', borderRadius: '8px', border: 'none' }}>
          "{segment.gemma_decision.observation}"
        </div>
      )}
    </div>
  );
}
