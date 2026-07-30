import Dexie from 'dexie';

export const db = new Dexie('AmanaDatabase');

// Version 1 (old Amana) had a flat 'packages' store — must be explicitly handled
db.version(1).stores({
  packages: 'id, trigger_type, timestamp_start, disposition'
});

// Version 2: Adaptive Evidence Acquisition Schema
db.version(2).stores({
  packages: null, // Drop old packages store
  incidents: 'id, rec_number, started_at, ended_at, status, trigger_type, disposition',
  segments: 'id, incident_id, segment_number, recorded_at'
});

// Version 3: Solid Multimodal Chat Threads & Messages Schema
db.version(3).stores({
  packages: null,
  incidents: 'id, rec_number, started_at, ended_at, status, trigger_type, disposition',
  segments: 'id, incident_id, segment_number, recorded_at',
  chat_threads: 'id, title, created_at, updated_at',
  chat_messages: 'id, thread_id, sender, created_at'
});

// Version 4: Immutable Forensic Audit Trail Schema (Paper Trail for ALL decisions)
db.version(4).stores({
  packages: null,
  incidents: 'id, rec_number, started_at, ended_at, status, trigger_type, disposition',
  segments: 'id, incident_id, segment_number, recorded_at',
  chat_threads: 'id, title, created_at, updated_at',
  chat_messages: 'id, thread_id, sender, created_at',
  audit_logs: 'id, incident_id, timestamp, status, trigger_type'
});

/**
 * Get permanent recording number for an incident
 */
export function getPermanentRecNumber(inc, index, totalIncidentsCount) {
  if (inc?.rec_number) return inc.rec_number;
  if (!inc?.id) return index + 1;

  const storageKey = `amana_rec_num_${inc.id}`;
  const storedNum = localStorage.getItem(storageKey);
  if (storedNum) {
    return parseInt(storedNum, 10);
  }

  const assignedNum = totalIncidentsCount - index;
  localStorage.setItem(storageKey, assignedNum.toString());
  return assignedNum;
}

/**
 * Incidents CRUD
 */
export async function createIncident(triggerType, initialGps = null) {
  let lastSeq = parseInt(localStorage.getItem('amana_recording_seq') || '0', 10);
  if (lastSeq === 0) {
    const existingCount = await db.incidents.count();
    lastSeq = existingCount > 0 ? existingCount : 0;
  }
  lastSeq += 1;
  localStorage.setItem('amana_recording_seq', lastSeq.toString());

  const incident = {
    id: crypto.randomUUID(),
    rec_number: lastSeq,
    started_at: new Date().toISOString(),
    ended_at: null,
    status: 'collecting',
    trigger_type: triggerType || 'audio',
    disposition: 'unreviewed',
    ledger: {
      collection_window: 0,
      elapsed_seconds: 0,
      trigger_type: triggerType,
      known_entities: [],
      detected_events: [],
      location_history: initialGps ? [initialGps] : [],
      conversation_observations: [],
      investigation_leads: [],
      confidence_score: 0.85,
      confidence_trend: 'stable',
      decision_history: [],
      gemma_call_count: 0,
      last_gemma_response: null
    },
    gps_trail: initialGps ? [initialGps] : [],
    final_report: null
  };

  localStorage.setItem(`amana_rec_num_${incident.id}`, lastSeq.toString());
  await db.incidents.put(incident);
  return incident;
}

export async function updateIncidentLedger(id, updatedLedger, status = 'collecting') {
  const updateData = { ledger: updatedLedger, status };
  if (status === 'closed') {
    updateData.ended_at = new Date().toISOString();
  }
  await db.incidents.update(id, updateData);
  return await db.incidents.get(id);
}

export async function appendGpsPoint(id, gpsPoint) {
  const incident = await db.incidents.get(id);
  if (!incident) return;
  const trail = incident.gps_trail || [];
  trail.push(gpsPoint);
  await db.incidents.update(id, { gps_trail: trail });
}

export async function closeIncident(id) {
  await db.incidents.update(id, {
    status: 'closed',
    ended_at: new Date().toISOString()
  });
  return await db.incidents.get(id);
}

export async function saveIncidentReport(id, finalReport) {
  await db.incidents.update(id, { final_report: finalReport });
  return await db.incidents.get(id);
}

export async function getAllIncidents() {
  return await db.incidents.orderBy('started_at').reverse().toArray();
}

export async function getIncidentById(id) {
  return await db.incidents.get(id);
}

export async function deleteIncident(id) {
  await db.transaction('rw', db.incidents, db.segments, async () => {
    await db.segments.where('incident_id').equals(id).delete();
    await db.incidents.delete(id);
  });
}

export async function discardTempTrialData(id) {
  if (!id) return;
  await db.transaction('rw', db.incidents, db.segments, async () => {
    await db.segments.where('incident_id').equals(id).delete();
    await db.incidents.delete(id);
    localStorage.removeItem(`amana_rec_num_${id}`);
  });
}

export async function clearAllIncidents() {
  await db.transaction('rw', db.incidents, db.segments, db.chat_threads, db.chat_messages, async () => {
    await db.segments.clear();
    await db.incidents.clear();
    await db.chat_threads.clear();
    await db.chat_messages.clear();
  });
}

/**
 * Segments CRUD
 */
export async function saveSegment(segmentData) {
  const segment = {
    id: segmentData.id || crypto.randomUUID(),
    incident_id: segmentData.incident_id,
    segment_number: segmentData.segment_number || 1,
    recorded_at: segmentData.recorded_at || new Date().toISOString(),
    duration_ms: segmentData.duration_ms || 15000,
    audio_blob: segmentData.audio_blob,
    local_hash: segmentData.local_hash,
    audio_features: segmentData.audio_features || {},
    sensor_snapshot: segmentData.sensor_snapshot || {},
    gemma_decision: segmentData.gemma_decision || null
  };

  await db.segments.put(segment);
  return segment;
}

export async function updateSegmentDecision(segmentId, gemmaDecision) {
  await db.segments.update(segmentId, { gemma_decision: gemmaDecision });
}

export async function getSegmentsForIncident(incidentId) {
  return await db.segments.where('incident_id').equals(incidentId).sortBy('segment_number');
}

/**
 * SOLID CHAT THREADS & MESSAGES CRUD
 */
export async function createChatThread(title = 'New Conversation', taggedIncidentIds = []) {
  const thread = {
    id: crypto.randomUUID(),
    title: title,
    tagged_incident_ids: taggedIncidentIds,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await db.chat_threads.put(thread);
  return thread;
}

export async function getAllChatThreads() {
  return await db.chat_threads.orderBy('updated_at').reverse().toArray();
}

export async function getChatMessages(threadId) {
  return await db.chat_messages.where('thread_id').equals(threadId).sortBy('created_at');
}

export async function addChatMessage({ threadId, sender, text, attachments = [], taggedIncidents = [] }) {
  const message = {
    id: crypto.randomUUID(),
    thread_id: threadId,
    sender: sender, // 'user' | 'gemma'
    text: text,
    attachments: attachments, // [{ type: 'image', mime: 'image/jpeg', data_base64: '...' }]
    tagged_incidents: taggedIncidents,
    created_at: new Date().toISOString()
  };

  await db.chat_messages.put(message);
  await db.chat_threads.update(threadId, { updated_at: new Date().toISOString() });
  return message;
}

export async function updateThreadTitle(threadId, newTitle) {
  await db.chat_threads.update(threadId, { title: newTitle, updated_at: new Date().toISOString() });
}

export async function updateThreadTaggedIncidents(threadId, taggedIncidentIds) {
  await db.chat_threads.update(threadId, { tagged_incident_ids: taggedIncidentIds, updated_at: new Date().toISOString() });
}

/**
 * UNIQUE CASE FILE NAMER
 * Formats: "Keffi Highway — Loud Sound Spike (EV-8492)"
 */
export function generateUniqueCaseName(locationName, triggerType, recNumber) {
  let shortLoc = 'Keffi';
  if (locationName) {
    shortLoc = locationName.split('-')[0].split(',')[0].trim();
  }
  const triggerLabel = triggerType === 'motion' ? 'Motion' : triggerType === 'safety_timer' ? 'Timer' : 'Sound';
  const code = (recNumber || Math.floor(100 + Math.random() * 900)).toString();
  return `${shortLoc} • ${triggerLabel} #${code}`;
}

/**
 * FORENSIC AUDIT TRAIL (PAPER TRAIL) CRUD
 * Immutable decision log that persists even if audio blobs are discarded on QUIT
 */
export async function createAuditLog(logData) {
  const entry = {
    id: logData.id || crypto.randomUUID(),
    incident_id: logData.incident_id,
    case_name: logData.case_name || 'Event Investigation',
    timestamp: logData.timestamp || new Date().toISOString(),
    trigger_type: logData.trigger_type || 'audio',
    location: logData.location || 'Recorded Location',
    status: logData.status || 'evaluating', // 'evaluating' | 'keep' | 'quit'
    polls: logData.polls || [], // [{ window: 1, vote: 1, transcript: '...', rms: 0.45 }]
    transcripts: logData.transcripts || [],
    movement_summary: logData.movement_summary || {},
    final_decision: logData.final_decision || null,
    reason: logData.reason || 'Evaluating 90s continuous trial...'
  };

  await db.audit_logs.put(entry);
  return entry;
}

export async function updateAuditLog(logId, updates) {
  await db.audit_logs.update(logId, updates);
  return await db.audit_logs.get(logId);
}

export async function getAllAuditLogs() {
  return await db.audit_logs.orderBy('timestamp').reverse().toArray();
}

export async function deleteAuditLog(logId) {
  await db.audit_logs.delete(logId);
}

export async function deleteChatThread(threadId) {
  await db.transaction('rw', db.chat_threads, db.chat_messages, async () => {
    await db.chat_messages.where('thread_id').equals(threadId).delete();
    await db.chat_threads.delete(threadId);
  });
}
