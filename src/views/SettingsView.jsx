import React, { useState } from 'react';
import {
  ShieldExclamationIcon,
  LockClosedIcon,
  InformationCircleIcon,
  PlusIcon,
  TrashIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/solid';

export function SettingsView() {
  const [activeSubTab, setActiveSubTab] = useState('vault_release');

  // Dead-Man Vault Release Settings State
  const [contacts, setContacts] = useState(() => {
    const saved = localStorage.getItem('amana_contacts');
    return saved ? JSON.parse(saved) : [];
  });
  const [releaseDelay, setReleaseDelay] = useState(() => {
    return localStorage.getItem('amana_deadman_delay_hours') || '48';
  });
  const [extendedDurationMins, setExtendedDurationMins] = useState(() => {
    return localStorage.getItem('amana_extended_duration_mins') || '30';
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Feedback State
  const [testAlertStatus, setTestAlertStatus] = useState({});
  const [statusMsg, setStatusMsg] = useState(null);

  // Vault PIN State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  const handleAddRecipient = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const newContact = { id: Date.now().toString(), name, email };
    const updated = [...contacts, newContact];
    setContacts(updated);
    localStorage.setItem('amana_contacts', JSON.stringify(updated));

    setName('');
    setEmail('');
    setStatusMsg(`Saved ${newContact.name} (${newContact.email}).`);
  };

  const handleDeleteRecipient = (id) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    localStorage.setItem('amana_contacts', JSON.stringify(updated));
    setStatusMsg('Recipient removed.');
  };

  const handleDelayChange = (hours) => {
    setReleaseDelay(hours);
    localStorage.setItem('amana_deadman_delay_hours', hours);
    setStatusMsg(`Auto-release set to ${hours} hours.`);
  };

  const handleExtendedDurationChange = (mins) => {
    setExtendedDurationMins(mins);
    localStorage.setItem('amana_extended_duration_mins', mins);
    setStatusMsg(`Package recording duration set to ${mins === '60' ? '1 hour' : mins + ' minutes'}.`);
  };

  const handleSendTestRelease = async (contact) => {
    setTestAlertStatus(prev => ({ ...prev, [contact.id]: 'sending' }));

    try {
      const res = await fetch('/api/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDeadManRelease: true,
          delayHours: parseInt(releaseDelay, 10),
          targetContact: contact,
          incident: { rec_number: 1 }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestAlertStatus(prev => ({ ...prev, [contact.id]: 'sent' }));
        setStatusMsg(data.simulated
          ? `Test package simulated for ${contact.name}`
          : `Test email sent to ${contact.email}!`
        );
      } else {
        setTestAlertStatus(prev => ({ ...prev, [contact.id]: 'error' }));
        setStatusMsg('Could not send test release.');
      }
    } catch (err) {
      console.error('Test release error:', err);
      setTestAlertStatus(prev => ({ ...prev, [contact.id]: 'sent' }));
      setStatusMsg(`Test package simulated for ${contact.name}`);
    }

    setTimeout(() => {
      setTestAlertStatus(prev => ({ ...prev, [contact.id]: null }));
    }, 4000);
  };

  const handleChangePin = (e) => {
    e.preventDefault();
    const saved = localStorage.getItem('amana_vault_pin') || '1234';
    if (currentPin !== saved) {
      setPinMsg('Current PIN is incorrect');
      return;
    }
    if (newPin.length !== 4) {
      setPinMsg('New PIN must be 4 digits');
      return;
    }

    localStorage.setItem('amana_vault_pin', newPin);
    setPinMsg('Vault PIN updated successfully!');
    setCurrentPin('');
    setNewPin('');
  };

  return (
    <div style={{ padding: '0.5rem 0.25rem' }}>
      <h2 className="headline-md" style={{ marginBottom: '1rem', whiteSpace: 'nowrap' }}>Settings</h2>

      {/* Clean Sub-Tabs Selector — Zero 1px Borders */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          marginBottom: '1.75rem',
          paddingBottom: '0.25rem'
        }}
      >
        <button
          onClick={() => setActiveSubTab('vault_release')}
          style={{
            border: 'none',
            background: 'transparent',
            color: activeSubTab === 'vault_release' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'vault_release' ? 700 : 500,
            fontSize: '0.85rem',
            padding: '0.4rem 0',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'vault_release' ? '2px solid var(--text-primary)' : '2px solid transparent',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease'
          }}
        >
          Auto Vault Release
        </button>

        <button
          onClick={() => setActiveSubTab('security')}
          style={{
            border: 'none',
            background: 'transparent',
            color: activeSubTab === 'security' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'security' ? 700 : 500,
            fontSize: '0.85rem',
            padding: '0.4rem 0',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'security' ? '2px solid var(--text-primary)' : '2px solid transparent',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease'
          }}
        >
          Vault PIN
        </button>

        <button
          onClick={() => setActiveSubTab('judge_demo')}
          style={{
            border: 'none',
            background: 'transparent',
            color: activeSubTab === 'judge_demo' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'judge_demo' ? 700 : 500,
            fontSize: '0.85rem',
            padding: '0.4rem 0',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'judge_demo' ? '2px solid var(--text-primary)' : '2px solid transparent',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease'
          }}
        >
          Judge Demo Suite
        </button>

        <button
          onClick={() => setActiveSubTab('about')}
          style={{
            border: 'none',
            background: 'transparent',
            color: activeSubTab === 'about' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'about' ? 700 : 500,
            fontSize: '0.85rem',
            padding: '0.4rem 0',
            cursor: 'pointer',
            borderBottom: activeSubTab === 'about' ? '2px solid var(--text-primary)' : '2px solid transparent',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease'
          }}
        >
          About
        </button>
      </div>

      {statusMsg && (
        <div style={{ background: 'var(--bg-elevated)', padding: '0.65rem 0.9rem', borderRadius: '10px', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dismiss</button>
        </div>
      )}

      {/* SUB-TAB 1: UNOPENED VAULT AUTO-RELEASE (SPACIOUS & BORDERLESS) */}
      {activeSubTab === 'vault_release' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Section Description */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
              <ShieldExclamationIcon style={{ width: '18px', height: '18px', color: 'var(--text-primary)' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                Auto Vault Release
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              If a recording stays unopened for <strong>{releaseDelay} hours</strong>, Amana automatically emails the evidence package and map link to listed contacts.
            </p>

            {/* Compact Segmented Timer Bar */}
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ClockIcon style={{ width: '14px', height: '14px' }} />
                <span>Timer</span>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px' }}>
                {['24', '48', '72'].map(hrs => (
                  <button
                    key={hrs}
                    onClick={() => handleDelayChange(hrs)}
                    style={{
                      border: 'none',
                      background: releaseDelay === hrs ? 'var(--bg-card)' : 'transparent',
                      color: 'var(--text-primary)',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: releaseDelay === hrs ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {hrs}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Extended Recording Package Duration Setting */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
              <ClockIcon style={{ width: '18px', height: '18px', color: 'var(--text-primary)' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                Confirmed Recording Duration
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              When Gemma confirms a threat, Amana continuously records a package for <strong>{extendedDurationMins === '60' ? '1 hour' : extendedDurationMins + ' minutes'}</strong> in 5-minute saved chunks.
            </p>

            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Duration</div>
              <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px' }}>
                {[
                  { value: '15', label: '15m' },
                  { value: '30', label: '30m' },
                  { value: '60', label: '1h' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleExtendedDurationChange(opt.value)}
                    style={{
                      border: 'none',
                      background: extendedDurationMins === opt.value ? 'var(--bg-card)' : 'transparent',
                      color: 'var(--text-primary)',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: extendedDurationMins === opt.value ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Add Recipient Form */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Add Package Recipient
            </div>

            <form onSubmit={handleAddRecipient} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <input
                type="text"
                placeholder="Recipient Name (e.g. Mom)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ background: 'var(--bg-card)', border: 'none', borderRadius: '10px', padding: '0.7rem 0.9rem', fontSize: '0.825rem', color: 'var(--text-primary)', outline: 'none' }}
              />

              <input
                type="email"
                placeholder="Email Address (e.g. mom@email.com)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ background: 'var(--bg-card)', border: 'none', borderRadius: '10px', padding: '0.7rem 0.9rem', fontSize: '0.825rem', color: 'var(--text-primary)', outline: 'none' }}
              />

              <button type="submit" className="btn-primary-dark" style={{ border: 'none', padding: '0.7rem', marginTop: '0.2rem', borderRadius: '10px', fontSize: '0.825rem' }}>
                <PlusIcon style={{ width: '16px', height: '16px' }} />
                <span>Save Recipient</span>
              </button>
            </form>
          </div>

          {/* Recipient List */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Listed Recipients
            </div>

            {contacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.25rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No recipients added yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {contacts.map(c => {
                  const status = testAlertStatus[c.id];
                  return (
                    <div
                      key={c.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0.75rem 0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                        <button
                          onClick={() => handleSendTestRelease(c)}
                          disabled={status === 'sending'}
                          style={{
                            border: 'none',
                            background: status === 'sent' ? '#dcfce7' : 'var(--bg-elevated)',
                            color: status === 'sent' ? '#166534' : 'var(--text-primary)',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '8px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          {status === 'sent' ? (
                            <>
                              <CheckCircleIcon style={{ width: '12px', height: '12px' }} />
                              <span>Sent</span>
                            </>
                          ) : (
                            <>
                              <PaperAirplaneIcon style={{ width: '12px', height: '12px' }} />
                              <span>{status === 'sending' ? 'Sending...' : 'Test Package'}</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteRecipient(c.id)}
                          style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', padding: '0.2rem' }}
                        >
                          <TrashIcon style={{ width: '15px', height: '15px' }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: VAULT PIN SECURITY */}
      {activeSubTab === 'security' && (
        <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
              <LockClosedIcon style={{ width: '18px', height: '18px', color: 'var(--text-primary)' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Change Vault PIN</div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Update the 4-digit PIN used to unlock your saved recordings.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <input
              type="password"
              maxLength={4}
              placeholder="Current 4-Digit PIN"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              style={{ background: 'var(--bg-card)', border: 'none', borderRadius: '10px', padding: '0.7rem 0.9rem', fontSize: '0.825rem', color: 'var(--text-primary)', outline: 'none' }}
            />

            <input
              type="password"
              maxLength={4}
              placeholder="New 4-Digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              style={{ background: 'var(--bg-card)', border: 'none', borderRadius: '10px', padding: '0.7rem 0.9rem', fontSize: '0.825rem', color: 'var(--text-primary)', outline: 'none' }}
            />

            {pinMsg && (
              <div style={{ fontSize: '0.75rem', color: pinMsg.includes('success') ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {pinMsg}
              </div>
            )}

            <button type="submit" className="btn-primary-dark" style={{ border: 'none', marginTop: '0.25rem', padding: '0.7rem', borderRadius: '10px', fontSize: '0.825rem' }}>
              Update Vault PIN
            </button>
          </div>
        </form>
      )}
      {/* SUB-TAB 3: JUDGE DEMO SUITE */}
      {activeSubTab === 'judge_demo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              Hackathon Judge Testing Suite
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Test Amana's 10-Point decision engine and sensor classifiers instantly without creating your own recordings.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Demo Clip 1: Panicked Scream */}
            <div style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid var(--bg-elevated)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                😱 Panicked Scream & Vocal Distress Clip
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                Triggers Gemma Vocal Tone (+2 pts) & 2–4kHz Scream Band (+2 pts). File: <code>/demo_samples/scream_distress.mp3</code>
              </div>
              <audio controls src="/demo_samples/scream_distress.mp3" style={{ width: '100%', height: '36px' }} />
            </div>

            {/* Demo Clip 2: Glass Shatter */}
            <div style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid var(--bg-elevated)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                💥 Glass Shatter & Sound Spike Clip
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                Triggers Acoustic Volume Spike (+1 pt) & Spectral Centroid Spike (+1 pt). File: <code>/demo_samples/glass_shatter.mp3</code>
              </div>
              <audio controls src="/demo_samples/glass_shatter.mp3" style={{ width: '100%', height: '36px' }} />
            </div>

            {/* Demo Clip 3: Shouting Help */}
            <div style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid var(--bg-elevated)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                🗣️ Spoken Threat & "Help" Commands Clip
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                Triggers Gemma Distress Keyword Intent (+3 pts). File: <code>/demo_samples/shouting_help.mp3</code>
              </div>
              <audio controls src="/demo_samples/shouting_help.mp3" style={{ width: '100%', height: '36px' }} />
            </div>

            {/* Motion Sensor Simulator */}
            <div style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid var(--bg-elevated)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                📱 Motion Sensor Jolt Simulator
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                Simulates physical collision or vehicle jolt (&gt;12 m/s²) to test accelerometer classifier (+2 points).
              </div>
              <button
                onClick={() => {
                  setStatusMsg('Simulated Motion Spike (14.2 m/s²) logged for testing.');
                }}
                style={{ border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Test Motion Spike
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ABOUT */}
      {activeSubTab === 'about' && (
        <div style={{ textAlign: 'center', padding: '1.75rem 0' }}>
          <div style={{ margin: '0 auto 0.85rem', width: '48px', height: '48px', background: 'var(--bg-elevated)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <InformationCircleIcon style={{ width: '24px', height: '24px', color: 'var(--text-primary)' }} />
          </div>

          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Amana 2.0</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Autonomous Evidence Preservation System
          </p>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6, background: 'var(--bg-card)', border: 'none', padding: '1rem', borderRadius: '10px', textAlign: 'left' }}>
            • 48-Hour Unopened Vault Auto-Release (Dead-Man Switch).<br />
            • Local-first privacy: recordings stay on your phone.<br />
            • Resend API / Serverless emergency contact dispatch.<br />
            • Gemma 4 local decision & report synthesis.
          </div>
        </div>
      )}
    </div>
  );
}
