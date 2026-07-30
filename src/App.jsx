import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navigation } from './components/Navigation';
import { Toast } from './components/Toast';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { SafetyTimerModal } from './components/SafetyTimerModal';
import { MapLocationModal } from './components/MapLocationModal';
import { ActivityLogModal } from './components/ActivityLogModal';
import { OnboardingView } from './views/OnboardingView';
import { HomeView } from './views/HomeView';
import { VaultView } from './views/VaultView';
import { ChatView } from './views/ChatView';
import { SettingsView } from './views/SettingsView';

import {
  initAudioEngine,
  startAudioMonitoring,
  stopAudioMonitoring
} from './services/audioEngine';
import { startMotionMonitoring, stopMotionMonitoring } from './services/motionEngine';
import { db, deleteIncident, clearAllIncidents } from './services/db';
import { triggerIncident, subscribeEngineState, checkDeadManVaultRelease, checkPendingGemmaReports, requestManualStop } from './services/incidentEngine';
import { getCurrentGpsFix, startGpsTracking, stopGpsTracking } from './services/gpsService';

export function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(
    localStorage.getItem('kodamana_onboarding_done') === 'true'
  );

  const [activeTab, setActiveTab] = useState('home');
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [chatIncidentId, setChatIncidentId] = useState(null);

  // Modal states
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Sensor state
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [sensorStates, setSensorStates] = useState({ mic: true, gps: true, motion: true });
  const [enginePhase, setEnginePhase] = useState('IDLE');
  const [activeIncident, setActiveIncident] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [currentGps, setCurrentGps] = useState(null);
  const [gpsTrail, setGpsTrail] = useState([]);

  // Live Dexie query for Incidents
  const incidents = useLiveQuery(
    () => db.incidents.orderBy('started_at').reverse().toArray(),
    []
  ) || [];

  // Subscribe to engine state machine
  useEffect(() => {
    subscribeEngineState((phase, incident) => {
      setEnginePhase(phase);
      setActiveIncident(incident);

      if (phase === 'TRIGGERED') {
        setToastMessage('Sound heard · Checking now...');
      } else if (phase === 'CLOSED') {
        setToastMessage('Saved safely in Vault.');
        // Run 30-min report check after closing
        checkPendingGemmaReports().catch(() => {});
      }
    });

    // Run 48-Hour Vault Release & 30-Min Gemma Report Checkers on startup
    checkDeadManVaultRelease().catch(err => console.warn('Vault release check error:', err));
    checkPendingGemmaReports().catch(err => console.warn('Gemma report check error:', err));

    // Periodic 60s background check for 30m reports & 48h dead-man releases
    const checkInterval = setInterval(() => {
      checkDeadManVaultRelease().catch(() => {});
      checkPendingGemmaReports().catch(() => {});
    }, 60000);

    // Start background GPS fix & continuous watcher
    getCurrentGpsFix().then(fix => {
      if (fix) setCurrentGps(fix);
    }).catch(err => console.warn('GPS initial fix warning:', err));

    startGpsTracking((fix, trail) => {
      if (fix) setCurrentGps(fix);
      if (trail) setGpsTrail(trail);
    });

    return () => clearInterval(checkInterval);
  }, []);

  // Initialize sensors after onboarding
  useEffect(() => {
    if (hasCompletedOnboarding) {
      initAudioEngine()
        .then(() => {
          if (sensorStates.mic) {
            startAudioMonitoring({
              onTrigger: (evt) => triggerIncident(evt.trigger_type || 'audio')
            });
          }
          if (sensorStates.motion) {
            startMotionMonitoring({
              onMotion: (evt) => triggerIncident(evt.trigger_type || 'motion')
            });
          }
        })
        .catch(err => console.warn('Audio init error:', err));
    }
  }, [hasCompletedOnboarding]);

  // Handle Sensor Toggling from Header Icons
  const handleToggleSensor = (sensorName) => {
    setSensorStates(prev => {
      const next = { ...prev, [sensorName]: !prev[sensorName] };

      if (sensorName === 'mic') {
        if (next.mic) {
          startAudioMonitoring({ onTrigger: (evt) => triggerIncident('audio') });
          setToastMessage('Microphone turned ON');
        } else {
          stopAudioMonitoring();
          setToastMessage('Microphone turned OFF');
        }
      } else if (sensorName === 'gps') {
        if (next.gps) {
          startGpsTracking((fix, trail) => {
            if (fix) setCurrentGps(fix);
            if (trail) setGpsTrail(trail);
          });
          setToastMessage('GPS Location turned ON');
        } else {
          stopGpsTracking();
          setToastMessage('GPS Location turned OFF');
        }
      } else if (sensorName === 'motion') {
        if (next.motion) {
          startMotionMonitoring({ onMotion: (evt) => triggerIncident('motion') });
          setToastMessage('Motion Sensors turned ON');
        } else {
          stopMotionMonitoring();
          setToastMessage('Motion Sensors turned OFF');
        }
      }

      return next;
    });
  };

  const handleCompleteOnboarding = () => {
    localStorage.setItem('kodamana_onboarding_done', 'true');
    setHasCompletedOnboarding(true);
  };

  const handleOpenChatWithIncident = (incidentId) => {
    setChatIncidentId(incidentId);
    setActiveTab('chat');
  };

  const handleStopRecording = () => {
    requestManualStop();
    setToastMessage('Recording session stopped');
  };

  return (
    <div className="app-container">
      {hasCompletedOnboarding && (
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          enginePhase={enginePhase}
          sensorStates={sensorStates}
          onToggleSensor={handleToggleSensor}
          onManualTrigger={() => triggerIncident('combined')}
        />
      )}

      <main className="main-content">
        {!hasCompletedOnboarding ? (
          <OnboardingView onCompleteOnboarding={handleCompleteOnboarding} />
        ) : activeTab === 'home' ? (
          <HomeView
            incidentCount={incidents.length}
            currentGps={currentGps}
            enginePhase={enginePhase}
            activeIncident={activeIncident}
            onOpenVault={() => setActiveTab('vault')}
            onOpenSafetyTimer={() => setIsTimerModalOpen(true)}
            onOpenChat={() => setActiveTab('chat')}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenMapModal={() => setIsMapModalOpen(true)}
            onOpenLogModal={() => setIsLogModalOpen(true)}
            onStopRecording={handleStopRecording}
          />
        ) : activeTab === 'vault' ? (
          <VaultView
            incidents={incidents}
            isVaultUnlocked={isVaultUnlocked}
            onUnlockVault={() => setIsVaultUnlocked(true)}
            onOpenChatWithIncident={handleOpenChatWithIncident}
            onDeleteIncident={async (id) => {
              await deleteIncident(id);
              setToastMessage('Saved recording deleted');
            }}
            onClearAllIncidents={async () => {
              await clearAllIncidents();
              setToastMessage('All saved recordings cleared');
            }}
          />
        ) : activeTab === 'chat' ? (
          <ChatView
            incidents={incidents}
            initialIncidentId={chatIncidentId}
          />
        ) : (
          <SettingsView />
        )}
      </main>

      {/* Modals */}
      <SafetyTimerModal
        isOpen={isTimerModalOpen}
        onClose={() => setIsTimerModalOpen(false)}
        onTimerExpired={() => {
          setIsTimerModalOpen(false);
          triggerIncident('safety_timer');
          setToastMessage('Safety timer expired. Recording saved & sent to Gemma.');
        }}
      />

      <MapLocationModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        gpsTrail={gpsTrail}
      />

      <ActivityLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />

      {/* PWA Native Install Prompt */}
      <PwaInstallPrompt />

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
