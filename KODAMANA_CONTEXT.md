# KODAMANA — Canonical Context Document
### Authoritative Reference for Any AI Model or Developer Working on This Project
**Version**: 1.0 | **Last Updated**: 2026-07-30

---

> This document is the single source of truth for Kodamana. If any previous conversation, prompt, plan, or code conflicts with this document, **this document wins**. Do not deviate from this context without explicit written instruction from the project owner.

---

## 01 — What Kodamana Is

**Kodamana** is an offline-first, autonomous evidence preservation system for violent incidents. It is a Progressive Web App (PWA) hosted on Vercel.

**One-sentence definition**:
> Kodamana is an autonomous, offline-first evidence collection system that uses lightweight edge detection to recognize possible incidents and uses Gemma as the reasoning layer that decides whether evidence collection should continue — and later transforms the preserved evidence into an interpretable investigation report.

---

## 02 — What Kodamana Is NOT

This list is as important as the definition. Violating any of these is an architectural error:

| It is NOT | Reason |
|---|---|
| An emergency SOS app | It does not call anyone, send alerts, or notify contacts |
| A continuous audio recorder | It is idle/low-power the vast majority of its lifetime |
| A real-time livestreaming system | No audio or data is streamed live to any server |
| A replacement for emergency services | Evidence is preserved for later review, not real-time dispatch |
| An app that requires user interaction | It assumes the victim CANNOT interact with the device |
| An app where Gemma does the detection | Lightweight classifiers detect; Gemma reasons |
| A chat interface or conversational app | Gemma outputs are structured JSON consumed by the app, not English for users |
| A blockchain anchoring system | Hash integrity is local only |

---

## 03 — System Architecture (Correct Mental Model)

```
IDLE (99% of lifetime)
  ↓
Lightweight Classifiers run continuously (audio spike, motion, accelerometer)
  ↓
TRIGGER FIRES → Evidence Collection Phase begins
  ↓
Kodamana records audio + collects sensors (GPS, accelerometer, timestamps)
  ↓
After ~15 seconds: Gemma Call #1 (multimodal evidence package)
  ↓
Gemma returns: { decision: "continue" | "stop" | "observe_again", updated_ledger: {...} }
  ↓
  If "observe_again": collect another window → Gemma Call #2 (with previous context)
  If "continue": enter long-term collection mode (periodic Gemma check-ins)
  If "stop": end collection, preserve all evidence locally
  ↓
LONG-TERM COLLECTION (periodic Gemma check-ins every N seconds)
  ↓
COLLECTION ENDS → Everything hashed and stored locally in IndexedDB
  ↓
USER/INVESTIGATOR OPENS INCIDENT → Gemma generates full investigation report
```

### The Core Principle
> **Lightweight models detect. Kodamana collects. Gemma reasons. Kodamana acts.**

---

## 04 — Component Responsibilities (Strict)

### Lightweight Classifiers (Edge, Always-On)
- Run continuously in the browser on the main device
- Signals used: **audio RMS + 2–4kHz band energy** (scream/gunshot band), **accelerometer magnitude**, **motion** (DeviceMotionEvent)
- Answer ONE question: *"Has something unusual happened that is worth investigating further?"*
- Do NOT call Gemma. Do NOT record audio. Do NOT make interpretive decisions.
- Must be cheap: ≤5ms per frame, no GPU, no LLM

### MediaRecorder / Evidence Collector
- Only activates AFTER a classifier trigger
- Records audio in 15-second segments (WebM/Opus)
- Also collects: GPS coordinates + accuracy, accelerometer time series, timestamps, previous trigger state
- Does NOT call Gemma. Does NOT analyze audio.

### Evidence Ledger (Application State, Client-Side)
- An application-owned structured object in memory (and persisted to IndexedDB)
- Accumulates across ALL Gemma calls. Gemma has no memory — the app carries state forward.
- Every Gemma call receives: { previous_ledger, new_audio_segment, new_sensor_data, previous_gemma_response }
- Ledger grows richer with each iteration
- Ledger fields include: known entities, detected events, location timeline, conversation observations, investigation leads, confidence score, collection decision history

### Gemma (Reasoning Layer, NOT Detection Layer)
- Called only after evidence collection begins
- Receives a multimodal package: audio clip + structured sensor metadata + current ledger state + previous Gemma response
- NEVER asked: "Did a gunshot happen?" (the classifier already decided that)
- IS asked: "Given everything collected so far, what does it mean, should we continue, and what new facts can you extract?"
- Returns structured JSON, not English paragraphs at runtime
- Gemma's unique value: open-ended information discovery — names, places, vehicle types, languages, commands, relationships, intent
- Called via Vercel serverless proxy (/api/gemma), never directly from browser

### Vercel Serverless Function (/api/gemma)
- Single endpoint. Receives structured evidence package (JSON + base64 audio).
- Constructs Gemma prompt server-side
- Parses and validates Gemma's JSON response
- Returns structured response to client
- Contains GEMMA_API_KEY (never exposed to browser)
- Raw audio MAY be forwarded to Gemma here — only place it leaves the device

### IndexedDB Storage (Dexie.js)
- All evidence stored locally: audio blobs, evidence ledger, GPS timeline, sensor history, Gemma responses, final report
- SHA-256 hash computed for each audio segment on capture
- Accessible offline. No server-side persistence.

---

## 05 — Gemma's Exact Input/Output Contract

### Input Package (sent every 15s during collection)
```json
{
  "audio_clip_base64": "<base64 WebM/Opus, ~15s>",
  "sensor_summary": {
    "gps": { "lat": 0.0, "lng": 0.0, "accuracy_m": 15, "speed_mps": 0.0, "place_name": "Keffi Road, Nasarawa" },
    "accelerometer_peak": 18.4,
    "motion_pattern": "irregular_jolt",
    "timestamp": "2026-07-30T09:45:12+01:00"
  },
  "ledger": {
    "collection_window": 2,
    "elapsed_seconds": 30,
    "known_entities": [],
    "detected_events": [],
    "location_history": [],
    "previous_decision": "observe_again",
    "confidence_trend": "rising"
  },
  "previous_gemma_response": {}
}
```

### Output (Gemma returns structured JSON ONLY)
```json
{
  "decision": "continue",
  "confidence": 0.82,
  "updated_entities": ["Sergeant Musa", "Keffi Road"],
  "updated_events": ["aggressive commands issued", "vehicle door slammed"],
  "new_leads": ["vehicle type possibly mentioned", "second voice present"],
  "observation": "Audio contains commands in Hausa directed at subject. Motion corroborates physical altercation.",
  "stop_reason": null
}
```

Gemma never returns prose paragraphs at runtime. Prose is only for the final investigation report.

---

## 06 — PWA & Hosting Hard Constraints (Reality)

| Constraint | Impact | Mitigation |
|---|---|---|
| Browser tab killed by OS on screen lock | No true background monitoring | Screen Wake Lock API; user must keep app open |
| Service Workers cannot use getUserMedia | Cannot move audio monitoring to SW | Monitoring runs in active tab only |
| MediaRecorder on main thread | Acceptable; no blocking operations | Use requestAnimationFrame for analyzer |
| iOS DeviceMotionEvent needs permission gesture | iOS motion unreliable in passive mode | Degrade gracefully to audio-only on iOS |
| Geolocation requires HTTPS + user permission | Must be granted at startup | Request on "Start Monitoring" tap |
| IndexedDB storage limits | Chrome ~6% disk; Safari 1GB | Enforce max incidents, prompt cleanup |
| 15s audio clip base64 ≈ 200KB | Fits in one Gemma API call easily | No issue |
| Vercel Hobby function timeout 10s | Gemma calls may need up to 8s | Use Pro tier maxDuration: 30 |
| No SMS / background push without opt-in | Cannot notify when tab closed | Out of scope for MVP |

---

## 07 — Gemma API Reality

- **Model**: Gemini 2.5 Flash via Google AI Studio (called "Gemma" in product narrative)
- **Multimodal**: YES — accepts audio (base64 inline), text, images in one call
- **Context window**: 1M tokens — full ledger history fits comfortably
- **JSON output**: Use `responseMimeType: 'application/json'` to enforce JSON
- **Latency**: 2–8 seconds typical for 15s audio + JSON
- **Audio format accepted**: Inline base64 with mimeType `audio/webm`

---

## 08 — Technology Stack (Authoritative)

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 6 |
| PWA | vite-plugin-pwa + Workbox |
| Database | Dexie.js (IndexedDB) |
| Audio capture | MediaRecorder (WebM/Opus) |
| Signal processing | Web Audio API (AnalyserNode, 2048 FFT) |
| Motion | DeviceMotionEvent |
| Hashing | crypto.subtle.digest SHA-256 |
| Screen lock | navigator.wakeLock |
| Map | Google Maps JavaScript API (embed) |
| Reverse geocoding | Google Maps Geocoding API (server-side) |
| AI reasoning | Gemini 2.5 Flash via Google AI Studio |
| Backend proxy | Vercel Serverless Function (Node.js) |
| Hosting | Vercel (HTTPS mandatory) |
| Icons | Lucide React |

---

## 09 — What Currently Exists (as of 2026-07-30)

The codebase was scaffolded under the name "Amana" (old name, now Kodamana). The following exists and works:

### BUILT AND VERIFIED
- Vite + React PWA scaffold with Workbox service worker (production build passes)
- audioEngine.js — Web Audio API feature extraction (RMS, 2-4kHz, ZCR, centroid), 15s ambient calibration, MediaRecorder capture, SHA-256 hashing
- motionEngine.js — DeviceMotionEvent accelerometer spike detection (>15 m/s² threshold)
- db.js — Dexie.js IndexedDB schema for packages store
- reportService.js — Gemma proxy client + offline deterministic fallback
- api/generate-report.js — Vercel serverless proxy to Gemini API
- Full UI: LandingView, MonitorView, PackagesView, PackageDetailView, CalibrationModal, AudioVisualizer, Toast, Navigation
- Production bundle: 287KB JS, clean build

### NOT YET BUILT (See Gap Analysis)
- Iterative Gemma decision loop (continue/stop/observe_again state machine)
- Evidence Ledger data structure and accumulation logic
- Google Maps integration (GPS trail, reverse geocoding, embedded map)
- Multi-segment recording (15s windows that chain together)
- Gemma multimodal calls with actual base64 audio payload
- Investigation report generation (full end-of-incident analysis)
- Incident management model (incident != package; incidents contain many segments)
- App rename: Amana → Kodamana throughout codebase

---

## 10 — Canonical Terminology

| Term | Meaning |
|---|---|
| Kodamana | The app name |
| Incident | One full triggered evidence collection session, from trigger to close |
| Segment | A single 15-second audio + sensor collection window |
| Evidence Ledger | Accumulated app-owned structured state across all Gemma calls in one incident |
| Lightweight Classifier | Always-on edge logic: RMS + band energy + motion thresholds |
| Gemma | The reasoning layer (Gemini 2.5 Flash via Google AI Studio) |
| Gemma Decision Loop | The iterative continue/stop/observe_again cycle during live collection |
| Collection Window | One 15-second segment of audio + sensor data |
| Investigation Report | Final full Gemma analysis, generated when user opens a closed incident |
| Evidence Package | The JSON payload sent to Gemma at each decision point |
