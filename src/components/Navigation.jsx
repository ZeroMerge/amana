import React from 'react';
import {
  HomeIcon,
  LockClosedIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  MicrophoneIcon,
  MapPinIcon,
  DevicePhoneMobileIcon
} from '@heroicons/react/24/solid';

export function Navigation({
  activeTab,
  setActiveTab,
  enginePhase,
  sensorStates = { mic: true, gps: true, motion: true },
  onToggleSensor,
  onManualTrigger,
  onStopRecording
}) {
  const isRecording = enginePhase !== 'IDLE';

  return (
    <>
      {/* Fixed Top Status Header */}
      <header className="top-header">
        {/* Brand Icon Only */}
        <div className="brand-title" style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/amana_favicon.png"
            alt="Amana Icon"
            style={{ width: '28px', height: '28px', borderRadius: '8px', objectFit: 'contain' }}
          />
        </div>

        {/* Outer Control Box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: isRecording ? 'rgba(220, 38, 38, 0.12)' : 'var(--bg-elevated)',
            border: isRecording ? '1px solid rgba(220, 38, 38, 0.3)' : 'none',
            padding: '5px 9px',
            borderRadius: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          {/* Sensor Icons Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {/* Microphone Sensor */}
            <button
              onClick={() => onToggleSensor && onToggleSensor('mic')}
              title={sensorStates.mic ? (isRecording ? 'Recording Active' : 'Microphone On') : 'Microphone Off'}
              style={{
                border: 'none',
                background: 'transparent',
                borderRadius: '8px',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: sensorStates.mic ? 1 : 0.3,
                transition: 'opacity 0.2s ease'
              }}
            >
              <MicrophoneIcon style={{ width: '16px', height: '16px', color: isRecording && sensorStates.mic ? '#dc2626' : 'var(--text-primary)' }} />
            </button>

            {/* GPS Sensor */}
            <button
              onClick={() => onToggleSensor && onToggleSensor('gps')}
              title={sensorStates.gps ? 'GPS Location On' : 'GPS Location Off'}
              style={{
                border: 'none',
                background: 'transparent',
                borderRadius: '8px',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: sensorStates.gps ? 1 : 0.3,
                transition: 'opacity 0.2s ease'
              }}
            >
              <MapPinIcon style={{ width: '16px', height: '16px', color: 'var(--text-primary)' }} />
            </button>

            {/* Motion Sensor */}
            <button
              onClick={() => onToggleSensor && onToggleSensor('motion')}
              title={sensorStates.motion ? 'Motion Sensors On' : 'Motion Sensors Off'}
              style={{
                border: 'none',
                background: 'transparent',
                borderRadius: '8px',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: sensorStates.motion ? 1 : 0.3,
                transition: 'opacity 0.2s ease'
              }}
            >
              <DevicePhoneMobileIcon style={{ width: '16px', height: '16px', color: 'var(--text-primary)' }} />
            </button>
          </div>

          {/* Vertical Divider */}
          <div style={{ width: '1px', height: '14px', background: isRecording ? '#dc2626' : 'var(--text-muted)', opacity: 0.3 }} />

          {/* Quick Record OR Stop Button */}
          {isRecording ? (
            <button
              onClick={onStopRecording}
              title="Stop active recording session"
              style={{
                border: 'none',
                background: '#dc2626',
                borderRadius: '6px',
                padding: '3px 8px',
                color: '#ffffff',
                fontSize: '0.725rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(220,38,38,0.4)',
                animation: 'pulse 1.5s infinite ease-in-out'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff' }} />
              <span>STOP</span>
            </button>
          ) : (
            <button
              onClick={onManualTrigger}
              title="Start quick 15s recording"
              style={{
                border: 'none',
                background: 'transparent',
                borderRadius: '8px',
                padding: '2px 4px',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }} />
              <span>Rec</span>
            </button>
          )}
        </div>
      </header>

      {/* Fixed Bottom Navigation Bar (4 Items) */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <HomeIcon style={{ width: '20px', height: '20px' }} />
          <span>Home</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          <LockClosedIcon style={{ width: '20px', height: '20px' }} />
          <span>Vault</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <ChatBubbleLeftRightIcon style={{ width: '20px', height: '20px' }} />
          <span>Chat</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Cog6ToothIcon style={{ width: '20px', height: '20px' }} />
          <span>Settings</span>
        </button>
      </nav>
    </>
  );
}
