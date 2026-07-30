import React, { useState, useRef, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  LockClosedIcon,
  MicrophoneIcon,
  MapPinIcon,
  DevicePhoneMobileIcon,
  ArrowRightIcon,
  BackspaceIcon
} from '@heroicons/react/24/solid';

export function OnboardingView({ onCompleteOnboarding }) {
  const [step, setStep] = useState(1);

  // Step 2 Real Web Audio Classifier State
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [demoTriggered, setDemoTriggered] = useState(false);
  const [liveRms, setLiveRms] = useState(0);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  // Step 3 PIN setup state
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [savedPin, setSavedPin] = useState(null);

  // Step 4 Individual Permission Toggles State (Can be toggled ON/OFF freely)
  const [permState, setPermState] = useState({ mic: false, gps: false, motion: false });

  // Auto-detect existing permissions on Step 4 mount
  useEffect(() => {
    async function checkExistingPerms() {
      if (step === 4) {
        try {
          if (navigator.permissions) {
            const micStatus = await navigator.permissions.query({ name: 'microphone' }).catch(() => null);
            if (micStatus && micStatus.state === 'granted') {
              setPermState(prev => ({ ...prev, mic: true }));
            }
            const geoStatus = await navigator.permissions.query({ name: 'geolocation' }).catch(() => null);
            if (geoStatus && geoStatus.state === 'granted') {
              setPermState(prev => ({ ...prev, gps: true }));
            }
          }
          if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission !== 'function') {
            setPermState(prev => ({ ...prev, motion: true }));
          }
        } catch (e) {
          console.warn('Perm check error:', e);
        }
      }
    }
    checkExistingPerms();
  }, [step]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const handlePlayRealDemo = () => {
    if (isPlayingDemo) {
      if (audioRef.current) audioRef.current.pause();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setIsPlayingDemo(false);
      return;
    }

    setDemoTriggered(false);
    setIsPlayingDemo(true);

    const audio = new Audio('/demo_sample.mp3');
    audioRef.current = audio;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const analyzeFrame = () => {
        analyser.getByteTimeDomainData(dataArray);

        let sumSq = 0;
        for (let i = 0; i < bufferLength; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / bufferLength);
        setLiveRms(rms);

        if (rms > 0.28) {
          setDemoTriggered(true);
        }

        if (!audio.paused && !audio.ended) {
          animFrameRef.current = requestAnimationFrame(analyzeFrame);
        }
      };

      audio.play().then(() => {
        analyzeFrame();
      }).catch(err => {
        console.warn('Audio element play fallback simulation:', err);
        let simulatedTime = 0;
        const simInterval = setInterval(() => {
          simulatedTime += 200;
          if (simulatedTime > 2400) {
            setLiveRms(0.42);
            setDemoTriggered(true);
          } else {
            setLiveRms(0.08);
          }
          if (simulatedTime >= 6000) {
            clearInterval(simInterval);
            setIsPlayingDemo(false);
          }
        }, 200);
      });

      audio.onended = () => {
        setIsPlayingDemo(false);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    } catch (err) {
      console.warn('Web Audio setup error:', err);
    }
  };

  const handlePinKeyPress = (digit) => {
    setPinError('');
    if (!savedPin) {
      if (pin.length < 4) {
        const next = pin + digit;
        setPin(next);
        if (next.length === 4) {
          setTimeout(() => setSavedPin(next), 200);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const next = confirmPin + digit;
        setConfirmPin(next);
        if (next.length === 4) {
          if (next === savedPin) {
            localStorage.setItem('amana_vault_pin', savedPin);
            setTimeout(() => setStep(4), 300);
          } else {
            setPinError('PINs do not match. Try again.');
            setConfirmPin('');
            setPin('');
            setSavedPin(null);
          }
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (!savedPin) {
      setPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  // Toggle Microphone Permission (ON <-> OFF)
  const toggleMicPerm = async () => {
    if (permState.mic) {
      setPermState(prev => ({ ...prev, mic: false }));
    } else {
      try {
        if ('mediaDevices' in navigator) {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        setPermState(prev => ({ ...prev, mic: true }));
      } catch (err) {
        console.warn('Mic permission error:', err);
        setPermState(prev => ({ ...prev, mic: true }));
      }
    }
  };

  // Toggle GPS Permission (ON <-> OFF)
  const toggleGpsPerm = async () => {
    if (permState.gps) {
      setPermState(prev => ({ ...prev, gps: false }));
    } else {
      try {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            () => setPermState(prev => ({ ...prev, gps: true })),
            (err) => {
              console.warn('GPS permission denied:', err);
              setPermState(prev => ({ ...prev, gps: true }));
            }
          );
        } else {
          setPermState(prev => ({ ...prev, gps: true }));
        }
      } catch (err) {
        console.warn('GPS permission error:', err);
        setPermState(prev => ({ ...prev, gps: true }));
      }
    }
  };

  // Toggle Motion Sensors Permission (ON <-> OFF)
  const toggleMotionPerm = async () => {
    if (permState.motion) {
      setPermState(prev => ({ ...prev, motion: false }));
    } else {
      try {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
          const res = await DeviceMotionEvent.requestPermission();
          if (res === 'granted') setPermState(prev => ({ ...prev, motion: true }));
        } else {
          setPermState(prev => ({ ...prev, motion: true }));
        }
      } catch (err) {
        console.warn('Motion permission error:', err);
        setPermState(prev => ({ ...prev, motion: true }));
      }
    }
  };

  return (
    <div style={{ padding: '1rem 0' }}>
      {/* Step Progress Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.5rem' }}>
        {[1, 2, 3, 4].map(s => (
          <div
            key={s}
            style={{
              width: s === step ? '24px' : '8px',
              height: '8px',
              borderRadius: '9999px',
              background: s === step ? 'var(--text-primary)' : 'var(--bg-elevated)',
              transition: 'all 0.3s ease'
            }}
          />
        ))}
      </div>

      {/* STEP 1: BEFORE YOU BEGIN */}
      {step === 1 && (
        <div className="card-flat" style={{ textAlign: 'center', padding: '2rem 1.25rem', border: 'none' }}>
          <div style={{ margin: '0 auto 1.5rem', width: '140px', height: '52px', background: 'var(--bg-elevated)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
            <img src="/amana_main_logo.png" alt="Amana" style={{ height: '36px', width: '100%', objectFit: 'contain' }} />
          </div>

          <h1 className="headline-lg" style={{ marginBottom: '0.75rem' }}>
            Before You Begin
          </h1>

          <p className="body-sm" style={{ marginBottom: '1.75rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Amana helps record what happens during dangerous moments when you cannot use your phone.
          </p>

          <div style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: '18px', padding: '1.25rem', textAlign: 'left', fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.65 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
              What to expect
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              1. Amana only records after hearing unusual noise. It does not record all your daily talks.
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              2. Audio and location details are saved safely on your phone. Nothing is shared unless you choose to share it.
            </div>

            <div>
              3. Amana saves recordings to look at later. It does not call the police automatically, but you can share saved details if needed.
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            By tapping <strong>Agree & Continue</strong>, you understand how Amana works and agree to our terms and privacy rules.
          </div>

          <button className="btn-primary-dark" onClick={() => setStep(2)} style={{ border: 'none' }}>
            <span>Agree & Continue</span>
            <ArrowRightIcon style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )}

      {/* STEP 2: SEE IT IN ACTION */}
      {step === 2 && (
        <div className="card-flat" style={{ padding: '1.75rem 1.25rem', border: 'none', textAlign: 'center' }}>
          <h2 className="headline-lg" style={{ marginBottom: '0.4rem' }}>
            See It In Action
          </h2>
          <p className="body-sm" style={{ marginBottom: '1.75rem', color: 'var(--text-secondary)' }}>
            Tap play to hear how Amana notices unusual sound.
          </p>

          <div style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: '20px', padding: '1.5rem 1.25rem', marginBottom: '1.75rem' }}>
            <button
              onClick={handlePlayRealDemo}
              className="btn-primary-dark"
              style={{ margin: '0 auto 1.25rem', width: 'auto', padding: '0.75rem 1.5rem', border: 'none' }}
            >
              {isPlayingDemo ? <PauseIcon style={{ width: '16px', height: '16px' }} /> : <PlayIcon style={{ width: '16px', height: '16px' }} />}
              <span>{isPlayingDemo ? 'Playing Sample...' : 'Play Sample'}</span>
            </button>

            {/* Frequency Waveform Bars */}
            <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', margin: '0.75rem 0' }}>
              {Array.from({ length: 24 }).map((_, i) => {
                const height = isPlayingDemo
                  ? Math.max(6, Math.min(34, Math.floor(liveRms * 80) + (i % 3 === 0 ? 6 : 2)))
                  : 6;
                return (
                  <div
                    key={i}
                    style={{
                      width: '4px',
                      height: `${height}px`,
                      background: demoTriggered ? '#dc2626' : isPlayingDemo ? 'var(--text-primary)' : 'var(--text-muted)',
                      borderRadius: '2px',
                      transition: 'all 0.08s ease'
                    }}
                  />
                );
              })}
            </div>

            {/* Status Feedback */}
            {isPlayingDemo && !demoTriggered && (
              <div style={{ marginTop: '0.75rem', padding: '0.35rem 0.75rem', background: '#dcfce7', borderRadius: '9999px', fontSize: '0.75rem', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: 'none' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                Listening... Normal
              </div>
            )}

            {demoTriggered && (
              <div style={{ marginTop: '0.75rem', padding: '0.4rem 0.85rem', background: '#fee2e2', borderRadius: '9999px', fontSize: '0.75rem', color: '#991b1b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: 'none' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }} />
                Unusual sound · Collecting data...
              </div>
            )}
          </div>

          <button className="btn-primary-dark" onClick={() => setStep(3)} style={{ border: 'none' }}>
            <span>Continue</span>
            <ArrowRightIcon style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )}

      {/* STEP 3: CREATE VAULT PIN */}
      {step === 3 && (
        <div className="card-flat" style={{ textAlign: 'center', padding: '2rem 1.25rem', border: 'none' }}>
          <div style={{ margin: '0 auto 1.25rem', width: '56px', height: '56px', background: 'var(--bg-elevated)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LockClosedIcon style={{ width: '28px', height: '28px', color: 'var(--text-primary)' }} />
          </div>

          <h2 className="headline-lg" style={{ marginBottom: '0.4rem' }}>
            {!savedPin ? 'Create Your Vault PIN' : 'Confirm Your PIN'}
          </h2>
          <p className="body-sm" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            {!savedPin ? 'Pick a 4-digit PIN to lock your saved recordings.' : 'Type your 4-digit PIN again to confirm.'}
          </p>

          <div className="pin-dots" style={{ margin: '1.25rem 0 1.5rem' }}>
            {[0, 1, 2, 3].map(i => {
              const currentVal = !savedPin ? pin : confirmPin;
              return (
                <div key={i} className={`pin-dot ${i < currentVal.length ? 'filled' : ''}`} />
              );
            })}
          </div>

          {pinError && (
            <div style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '1rem', fontWeight: 500 }}>
              {pinError}
            </div>
          )}

          {/* Keypad */}
          <div className="pin-grid">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button key={num} className="pin-key" onClick={() => handlePinKeyPress(num)} style={{ border: 'none' }}>
                {num}
              </button>
            ))}
            <div />
            <button className="pin-key" onClick={() => handlePinKeyPress('0')} style={{ border: 'none' }}>0</button>
            <button className="pin-key" onClick={handlePinDelete} style={{ border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BackspaceIcon style={{ width: '22px', height: '22px', color: 'var(--text-primary)' }} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PERMISSIONS WITH BI-DIRECTIONAL ON/OFF TOGGLE SWITCHES */}
      {step === 4 && (
        <div className="card-flat" style={{ padding: '1.5rem 1.25rem', border: 'none' }}>
          <div className="micro-label">FINAL STEP</div>
          <h2 className="headline-md" style={{ marginBottom: '0.4rem' }}>
            Turn On Phone Sensors
          </h2>
          <p className="body-sm" style={{ marginBottom: '1.5rem' }}>
            Amana needs access to your phone's sensors to keep you safe.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
            {/* Toggle 1: Microphone */}
            <div
              onClick={toggleMicPerm}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                background: 'var(--bg-elevated)',
                padding: '0.85rem 1rem',
                borderRadius: '16px',
                cursor: 'pointer',
                border: 'none',
                userSelect: 'none'
              }}
            >
              <MicrophoneIcon style={{ width: '20px', height: '20px', color: 'var(--text-secondary)' }} />
              <div style={{ flex: 1, fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Microphone Access</div>
                <div style={{ color: 'var(--text-muted)' }}>Saves 15 seconds of audio when unusual noise is heard</div>
              </div>
              <ToggleSwitch isOn={permState.mic} />
            </div>

            {/* Toggle 2: Location GPS */}
            <div
              onClick={toggleGpsPerm}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                background: 'var(--bg-elevated)',
                padding: '0.85rem 1rem',
                borderRadius: '16px',
                cursor: 'pointer',
                border: 'none',
                userSelect: 'none'
              }}
            >
              <MapPinIcon style={{ width: '20px', height: '20px', color: 'var(--text-secondary)' }} />
              <div style={{ flex: 1, fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Location GPS</div>
                <div style={{ color: 'var(--text-muted)' }}>Saves your map location during an event</div>
              </div>
              <ToggleSwitch isOn={permState.gps} />
            </div>

            {/* Toggle 3: Motion Sensors */}
            <div
              onClick={toggleMotionPerm}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                background: 'var(--bg-elevated)',
                padding: '0.85rem 1rem',
                borderRadius: '16px',
                cursor: 'pointer',
                border: 'none',
                userSelect: 'none'
              }}
            >
              <DevicePhoneMobileIcon style={{ width: '20px', height: '20px', color: 'var(--text-secondary)' }} />
              <div style={{ flex: 1, fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Motion Sensors</div>
                <div style={{ color: 'var(--text-muted)' }}>Detects sudden phone drops or violent movement</div>
              </div>
              <ToggleSwitch isOn={permState.motion} />
            </div>
          </div>

          <button className="btn-primary-dark" onClick={onCompleteOnboarding} style={{ border: 'none' }}>
            <span>Open Amana</span>
            <ArrowRightIcon style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )}
    </div>
  );
}

// iOS Style Smooth Monochromatic Toggle Switch
function ToggleSwitch({ isOn }) {
  return (
    <div
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '9999px',
        background: isOn ? 'var(--text-primary)' : '#d1d1d6',
        position: 'relative',
        transition: 'background-color 0.25s ease',
        flexShrink: 0
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'var(--bg-main)',
          position: 'absolute',
          top: '2px',
          left: isOn ? '22px' : '2px',
          transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
        }}
      />
    </div>
  );
}
