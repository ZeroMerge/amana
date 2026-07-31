/**
 * Amana Adaptive Evidence Acquisition Engine
 * 90-Second 3-Poll Evaluation Protocol + 5-Minute Chunked Package Recording
 *
 * Stage 1: Trigger -> Continuous 90s Evaluation Phase (3 x 30s Chunks)
 * Stage 2: 3-Poll Decision Aggregation (Polls + Movement + Event Summary -> KEEP or QUIT)
 * Stage 3: If QUIT: Purge temporary trial clips from DB & RAM; Save NOTHING to Vault.
 * Stage 4: If KEEP: Create Vault Package, Record Extended Duration (15m/30m/1h) in 5-minute chunks.
 */

import {
  createIncident,
  updateIncidentLedger,
  closeIncident,
  saveSegment,
  updateSegmentDecision,
  appendGpsPoint,
  getAllIncidents,
  getSegmentsForIncident,
  saveIncidentReport,
  discardTempTrialData,
  createAuditLog,
  updateAuditLog,
  generateUniqueCaseName,
  db
} from './db';
import { captureAudioClip, extractFrameFeatures, blobTo16kHzWav, getLiveSpeechTranscript } from './audioEngine';
import { startGpsTracking, stopGpsTracking, getLatestGpsFix } from './gpsService';
import { getLatestMotionData } from './motionEngine';
import { callGemmaDecision, callGemmaReport, extractRawSpeech, enrichAudioContext } from './gemmaService';

let activeIncident = null;
let currentPhase = 'IDLE';
let onPhaseChangeCallback = null;
let onSegmentCapturedCallback = null;
let isLoopRunning = false;
let manualStopRequested = false;

export function getEngineState() {
  return { activeIncident, currentPhase, isLoopRunning };
}

export function subscribeEngineState(onPhaseChange, onSegmentCaptured) {
  onPhaseChangeCallback = onPhaseChange;
  onSegmentCapturedCallback = onSegmentCaptured;
}

function setPhase(phase) {
  currentPhase = phase;
  if (onPhaseChangeCallback) {
    onPhaseChangeCallback(phase, activeIncident);
  }
}

/**
 * 48-Hour Unopened Vault Release Checker (Dead-Man Switch Protocol)
 */
export async function checkDeadManVaultRelease() {
  try {
    const rawContacts = localStorage.getItem('amana_contacts');
    const contacts = rawContacts ? JSON.parse(rawContacts) : [];
    if (contacts.length === 0) return;

    const delayHours = parseInt(localStorage.getItem('amana_deadman_delay_hours') || '48', 10);
    const incidents = await getAllIncidents();
    const now = Date.now();

    for (const inc of incidents) {
      if (inc.disposition === 'unreviewed' && !inc.deadman_released && inc.started_at) {
        const elapsedMs = now - new Date(inc.started_at).getTime();
        const elapsedHours = elapsedMs / (1000 * 60 * 60);

        if (elapsedHours >= delayHours) {
          console.log(`[Dead-Man Switch Triggered] Recording #${inc.rec_number || inc.id} unopened for ${elapsedHours.toFixed(1)} hours (limit ${delayHours}h). Releasing package...`);

          try {
            await fetch('/api/send-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                isDeadManRelease: true,
                delayHours,
                contacts,
                incident: inc,
                location: inc.gps_trail?.[0] || null
              })
            });

            await db.incidents.update(inc.id, { deadman_released: true });
          } catch (err) {
            console.error('Dead-man release dispatch failed:', err);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Dead-man vault release check error:', err);
  }
}

/**
 * 30-Minute Automatic Gemma Investigation Report Generator
 */
export async function checkPendingGemmaReports() {
  try {
    const incidents = await getAllIncidents();
    const now = Date.now();
    const THIRTY_MINS_MS = 30 * 60 * 1000;

    for (const inc of incidents) {
      if (inc.status === 'closed' && !inc.final_report && (inc.ended_at || inc.started_at)) {
        const endedTime = inc.ended_at ? new Date(inc.ended_at).getTime() : new Date(inc.started_at).getTime();
        const elapsedMs = now - endedTime;

        if (elapsedMs >= THIRTY_MINS_MS) {
          console.log(`[30-Min Gemma Report] Generating report for Recording #${inc.rec_number || inc.id}...`);
          await generateGemmaReportOnDemand(inc.id);
        }
      }
    }
  } catch (err) {
    console.warn('Pending Gemma report check error:', err);
  }
}

/**
 * On-demand Gemma Report Generator
 */
export async function generateGemmaReportOnDemand(incidentId) {
  try {
    const inc = await db.incidents.get(incidentId);
    if (!inc) return null;

    const segments = await getSegmentsForIncident(inc.id);
    const report = await callGemmaReport(inc, segments);
    const updated = await saveIncidentReport(inc.id, report);
    return updated?.final_report || report;
  } catch (err) {
    console.error('Error generating Gemma report on demand:', err);
    return null;
  }
}

/**
 * Externally trigger an early stop of an active collection loop
 */
export function requestManualStop() {
  if (isLoopRunning) {
    manualStopRequested = true;
  }
}

/**
 * Handle Trigger Fired Event (Sound or Motion spike detected)
 */
export async function triggerIncident(triggerType = 'audio') {
  if (currentPhase !== 'IDLE' || isLoopRunning) return;
  isLoopRunning = true;
  manualStopRequested = false;

  try {
    setPhase('TRIGGERED');

    // 1. Obtain initial GPS fix & start continuous GPS tracking
    const initialGps = getLatestGpsFix();
    startGpsTracking(async (gpsFix) => {
      // Guard against stale closure when activeIncident is nulled on QUIT
      if (activeIncident && activeIncident.id) {
        await appendGpsPoint(activeIncident.id, gpsFix).catch(() => {});
      }
    });

    // 2. Begin Acquisition Loop (Trial Phase -> Final Decision -> Extended Mode)
    await runAcquisitionLoop(triggerType, initialGps);
  } catch (err) {
    console.error('Error in incident acquisition loop:', err);
  } finally {
    // Only call stopIncidentCollection if there is still an active incident
    // (QUIT path already sets phase to IDLE and nulls activeIncident)
    if (currentPhase !== 'IDLE') {
      await stopIncidentCollection();
    } else {
      // Still need to stop GPS tracking on QUIT path
      stopGpsTracking();
    }
    isLoopRunning = false;
  }
}

/**
 * MASTER ACQUISITION LOOP:
 * Stage 1: 90s Trial Phase (3 x 30s Chunks)
 * Stage 2: 3-Poll + Movement + Event Aggregation Call to Gemma
 * Stage 3: If QUIT -> Purge trial clips & delete temp incident. Save NOTHING to Vault.
 * Stage 4: If KEEP -> Lock Vault Package & Record Extended Duration in 5-minute chunks.
 */
async function runAcquisitionLoop(triggerType, initialGps) {
  // A. Create Temporary Incident Record & Permanent Audit Log Entry
  const tempIncident = await createIncident(triggerType, initialGps);
  activeIncident = tempIncident;

  const caseName = generateUniqueCaseName(initialGps?.place, triggerType, tempIncident.rec_number);

  // Update incident with unique case name
  await db.incidents.update(tempIncident.id, { case_name: caseName }).catch(() => {});

  const auditLog = await createAuditLog({
    incident_id: tempIncident.id,
    case_name: caseName,
    trigger_type: triggerType,
    location: initialGps ? `${initialGps.lat?.toFixed(4)}° N, ${initialGps.lng?.toFixed(4)}° E` : 'Keffi-Abuja Corridor',
    status: 'evaluating',
    polls: [],
    transcripts: [],
    movement_summary: {},
    reason: 'Evaluating 90s continuous trial...'
  });

  const polls = [];
  const pollDetails = [];
  const trialSegments = [];
  const transcripts = [];
  let maxPeakAccel = 0;
  let maxPeakRms = 0;
  let maxBandEnergy = 0;

  // ─────────────────────────────────────────────────────────────
  // STAGE 1: 3 x 30s CONTINUOUS EVALUATION TRIAL (90s TOTAL)
  // ─────────────────────────────────────────────────────────────
  for (let windowIdx = 1; windowIdx <= 3; windowIdx++) {
    if (manualStopRequested) break;

    setPhase('TRIGGERED');

    // Capture 15s Audio Window + SHA-256 Hash
    let audio_blob = null;
    let local_hash = null;
    try {
      const captured = await captureAudioClip(15000);
      audio_blob = captured.audio_blob;
      local_hash = captured.local_hash;
    } catch (err) {
      console.error(`Trial chunk ${windowIdx} capture warning:`, err);
      audio_blob = new Blob(['SILENT_AUDIO_FALLBACK'], { type: 'audio/webm' });
      local_hash = 'fallback_hash_' + Date.now();
    }

    const audioFeatures = extractFrameFeatures() || {};
    const motionData = getLatestMotionData();
    const currentGps = getLatestGpsFix();

    if (motionData.mag > maxPeakAccel) maxPeakAccel = motionData.mag;
    if ((audioFeatures.rms || 0.4) > maxPeakRms) maxPeakRms = audioFeatures.rms;
    if ((audioFeatures.band_2k_4k_energy || 0.2) > maxBandEnergy) maxBandEnergy = audioFeatures.band_2k_4k_energy;

    const sensorSnapshot = {
      gps: currentGps,
      accelerometer_peak: motionData.mag,
      motion_pattern: motionData.isSpike ? 'irregular_jolt' : 'steady',
      audio_features: {
        peak_rms: audioFeatures.rms || 0.40,
        band_2k_4k_energy: audioFeatures.band_2k_4k_energy || 0.20,
        dominant_frequency_hz: audioFeatures.dominant_frequency_hz || 2500,
        spectral_centroid: audioFeatures.spectral_centroid || 2200,
        zero_crossing_rate: audioFeatures.zero_crossing_rate || 0.10,
        sustained_duration_ms: 15000
      }
    };

    // Save temporary trial segment
    const savedSegment = await saveSegment({
      incident_id: tempIncident.id,
      segment_number: windowIdx,
      recorded_at: new Date().toISOString(),
      duration_ms: 15000,
      audio_blob,
      local_hash,
      audio_features: sensorSnapshot.audio_features,
      sensor_snapshot: sensorSnapshot,
      gemma_decision: null
    });
    trialSegments.push(savedSegment);

    // ─────────────────────────────────────────────────────────────
    // MULTI-STAGE SPEECH-TO-TEXT & REASONING PIPELINE
    // ─────────────────────────────────────────────────────────────
    setPhase('DECIDING');
    let pollVote = 0;
    let windowTranscript = 'Background ambient audio captured.';
    let windowReason = '';

    try {
      // 1. Re-encode WebM chunk to clean 16kHz Mono WAV Blob (full RIFF header)
      const wavBlob = await blobTo16kHzWav(audio_blob);

      // 2. Stage 1: Dual-Fusion Speech Extraction (Web Speech API + Gemini STT)
      const liveSpeech = getLiveSpeechTranscript();
      const rawStt = await extractRawSpeech(wavBlob, liveSpeech);

      // 3. Stage 2: Gemini Multimodal Enrichment (Speaker Diarization, Ambience & Intent)
      const enrichment = await enrichAudioContext({
        audioWavBlob: wavBlob,
        sttRaw: rawStt,
        sensorSnapshot,
        windowIdx
      });

      if (enrichment.corrected_transcript) {
        windowTranscript = enrichment.corrected_transcript;
        transcripts.push(enrichment.corrected_transcript);
      }

      // 4. Stage 3: Gemma 10-Point Threat Evaluator Decision
      const decisionRes = await callGemmaDecision({
        isFinalAggregation: false,
        audioBlob: wavBlob,
        sensorSummary: { ...sensorSnapshot, enrichment },
        ledger: activeIncident.ledger
      });

      pollVote = decisionRes.vote ?? (decisionRes.decision === 'keep' || enrichment.distress_intent ? 1 : 0);
      windowReason = decisionRes.reason || (pollVote === 1 ? 'Distress vocal tone or acoustic spike detected.' : 'Quiet background baseline.');
      await updateSegmentDecision(savedSegment.id, { ...decisionRes, enrichment });
    } catch (err) {
      console.warn(`Poll ${windowIdx} call error:`, err);
      pollVote = (audioFeatures.rms > 0.18 || motionData.mag > 8.0) ? 1 : 0;
      windowReason = pollVote === 1 ? 'Acoustic RMS sound spike detected.' : 'Quiet background baseline.';
    }

    polls.push(pollVote);
    pollDetails.push({
      window: windowIdx,
      vote: pollVote,
      transcript: windowTranscript,
      rms: (audioFeatures.rms || 0.4).toFixed(2),
      accel: motionData.mag,
      reason: windowReason
    });

    console.log(`[Trial Phase] Poll #${windowIdx} Vote: ${pollVote} (${polls.join(', ')})`);

    // Update permanent audit log with progress
    await updateAuditLog(auditLog.id, {
      polls: pollDetails,
      transcripts,
      movement_summary: { peak_accel: maxPeakAccel, pattern: maxPeakAccel > 8 ? 'irregular_jolt' : 'steady' }
    }).catch(() => {});

    // Accumulate ledger
    const currentLedger = activeIncident.ledger || {};
    const updatedLedger = {
      ...currentLedger,
      collection_window: windowIdx,
      elapsed_seconds: windowIdx * 15,
      gemma_call_count: (currentLedger.gemma_call_count || 0) + 1
    };
    activeIncident = await updateIncidentLedger(activeIncident.id, updatedLedger, 'collecting').catch(() => activeIncident);

    // GRACEFUL INTERRUPTION: If user requested stop during Poll 1 or Poll 2, preserve collected audio and exit
    if (manualStopRequested && windowIdx < 3) {
      console.log(`[Interrupted by User] Early stop during Poll #${windowIdx}. Preserving ${trialSegments.length} segment(s).`);

      await updateAuditLog(auditLog.id, {
        status: 'interrupted',
        final_decision: 'INTERRUPTED',
        reason: `Interrupted by User. Captured ${trialSegments.length} audio clip(s) saved safely.`
      }).catch(() => {});

      await db.incidents.update(tempIncident.id, {
        status: 'interrupted',
        case_name: `${caseName} (Interrupted)`,
        ended_at: new Date().toISOString()
      }).catch(() => {});

      setPhase('CLOSED');
      return;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 2: 3-POLL + MOVEMENT + EVENT AGGREGATION CALL
  // ─────────────────────────────────────────────────────────────
  setPhase('DECIDING');
  let finalDecision = 'keep';
  let decisionReason = manualStopRequested
    ? 'Interrupted by User after Poll 3. Recording saved safely.'
    : 'Threat confirmed by 3-poll evaluation & motion data.';

  try {
    const aggRes = await callGemmaDecision({
      isFinalAggregation: true,
      polls,
      movement_summary: {
        peak_accel: maxPeakAccel,
        pattern: maxPeakAccel > 8 ? 'irregular_jolt' : 'steady'
      },
      event_summary: {
        transcripts,
        peak_rms: maxPeakRms,
        band_2k_4k: maxBandEnergy
      },
      ledger: tempIncident.ledger
    });

    finalDecision = aggRes.decision || 'keep';
    if (aggRes.reason) decisionReason = aggRes.reason;
    if (manualStopRequested) {
      decisionReason += ' (Interrupted by User)';
      finalDecision = 'keep'; // Always keep audio if user manually recorded/interrupted at Poll 3
    }
  } catch (err) {
    console.warn('Final aggregation decision threw; applying safety-first KEEP fallback:', err);
    finalDecision = 'keep';
  }

  console.log(`[Final Aggregation Decision] Result: ${finalDecision.toUpperCase()} (Polls: [${polls.join(', ')}], Peak Accel: ${maxPeakAccel}m/s²)`);

  // ─────────────────────────────────────────────────────────────
  // STAGE 3: IF QUIT -> PURGE TRIAL AUDIO BLOBS (AUDIT LOG STAYS PERMANENTLY!)
  // ─────────────────────────────────────────────────────────────
  if (finalDecision === 'quit' && !manualStopRequested) {
    console.log('[Trial Outcome: QUIT] Discarding 90s trial audio blobs. Audit log stays permanent.');

    await updateAuditLog(auditLog.id, {
      status: 'quit',
      final_decision: 'QUIT',
      reason: decisionReason || 'Sound returned to normal background baseline. No threat detected.'
    });

    await discardTempTrialData(tempIncident.id);
    activeIncident = null;
    setPhase('IDLE');
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 4: IF KEEP -> LOCK VAULT PACKAGE & RECORD EXTENDED DURATION (5-MIN CHUNKS)
  // ─────────────────────────────────────────────────────────────
  console.log('[Trial Outcome: KEEP] Threat confirmed! Locking Vault Package & starting continuous 5-minute chunked recording.');

  await updateAuditLog(auditLog.id, {
    status: 'keep',
    final_decision: 'KEEP',
    reason: decisionReason || 'Threat confirmed by 3-poll evaluation & movement data.'
  });

  const targetMins = parseInt(localStorage.getItem('amana_extended_duration_mins') || '30', 10);
  const targetMs = targetMins * 60 * 1000;
  const CHUNK_MS = 5 * 60 * 1000; // 5-minute chunk size

  const startTime = Date.now();
  let currentChunkNum = trialSegments.length + 1;

  setPhase('LONG_TERM');

  while ((Date.now() - startTime) < targetMs && activeIncident && !manualStopRequested) {
    const remainingMs = targetMs - (Date.now() - startTime);
    const durationMs = Math.min(CHUNK_MS, remainingMs);

    if (durationMs < 5000) break; // Less than 5s left — wrap up

    let audio_blob = null;
    let local_hash = null;
    try {
      const captured = await captureAudioClip(durationMs);
      audio_blob = captured.audio_blob;
      local_hash = captured.local_hash;
    } catch (err) {
      console.error(`Extended recording chunk ${currentChunkNum} failed (mic lost/phone dying):`, err);
      break; // Save whatever chunks were recorded up to this point!
    }

    const audioFeatures = extractFrameFeatures() || {};
    const motionData = getLatestMotionData();
    const currentGps = getLatestGpsFix();

    const sensorSnapshot = {
      gps: currentGps,
      accelerometer_peak: motionData.mag,
      motion_pattern: motionData.isSpike ? 'irregular_jolt' : 'steady',
      audio_features: {
        peak_rms: audioFeatures.rms || 0.50,
        band_2k_4k_energy: audioFeatures.band_2k_4k_energy || 0.20,
        sustained_duration_ms: durationMs
      }
    };

    // Save 5-minute chunk directly to IndexedDB
    const savedChunk = await saveSegment({
      incident_id: activeIncident.id,
      segment_number: currentChunkNum,
      recorded_at: new Date().toISOString(),
      duration_ms: durationMs,
      audio_blob,
      local_hash,
      audio_features: sensorSnapshot.audio_features,
      sensor_snapshot: sensorSnapshot,
      gemma_decision: { decision: 'keep', vote: 1, reason: 'Extended active package recording.' }
    });

    if (onSegmentCapturedCallback) {
      onSegmentCapturedCallback(savedChunk);
    }

    currentChunkNum++;
  }

  // Generate final Gemma Report for confirmed package
  try {
    await generateGemmaReportOnDemand(activeIncident.id);
  } catch (err) {
    console.warn('Post-package Gemma report generation warning:', err);
  }
}

/**
 * Stop Incident Collection (called after loop ends or on manual stop)
 */
export async function stopIncidentCollection() {
  if (currentPhase === 'IDLE') return;
  setPhase('CLOSING');
  stopGpsTracking();

  if (activeIncident) {
    try {
      const closed = await closeIncident(activeIncident.id);
      activeIncident = closed;
    } catch (err) {
      console.error('Error closing incident in IndexedDB:', err);
    }
  }

  setPhase('CLOSED');

  setTimeout(() => {
    setPhase('IDLE');
    activeIncident = null;
    manualStopRequested = false;
  }, 2000);
}
