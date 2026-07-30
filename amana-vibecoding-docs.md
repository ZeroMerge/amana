# Amana — Vibe Coding Docs (6 Documents)

*Working name: "Amana" (Hausa: trust/safety/something entrusted to you). Change freely — search/replace.*

---

## 01 — PRD (Product Requirements Document)

| Field | Detail |
|---|---|
| **App Name** | Amana |
| **Tagline** | Evidence that speaks when you can't. |
| **Problem** | In police harassment, highway ambushes, and kidnapping attempts in Nigeria, people freeze — they don't press buttons, open apps, or say code phrases under real stress. By the time anyone thinks to act, the moment's evidence is already gone, and it becomes one person's word against another's. |
| **Target User** | Everyday Nigerians who regularly pass through high-risk corridors or interact with police checkpoints — traders, commuters, students — not high-profile individuals with security details. |
| **Core Value Proposition** | Fully passive, sensor-driven evidence capture — no button to press, no phrase to remember. The phone itself notices a violent-sound or violent-motion signature and quietly starts recording, hashing, and packaging proof, reviewable later, safely. |
| **Core Features (Must Have)** | Live microphone-based sound-spike/distress detection (real, not simulated); live motion-spike detection via phone accelerometer; auto-capture of a short audio clip + photo on trigger; local SHA-256 hashing of captured evidence; private "trigger package" list view (no alarm/panic UI); on-demand Gemma-generated structured incident report from a captured package; hosted web app any judge can open and test on their own phone |
| **Nice to Have (v2)** | Real Android background service (works with screen off/app closed); SMS fallback delivery to trusted contacts; public blockchain hash-anchoring for tamper-proof timestamps; multilingual report output; route-anomaly detection against travel history; community/vigilante network sharing |
| **Out of Scope (this version)** | True 24/7 background operation while the phone is locked or the browser tab is closed; real SMS gateway integration; live reporting to police/authorities; production-grade security hardening; actual blockchain anchoring (hash is shown/logged, not published on-chain yet) |
| **User Stories** | As a commuter, I want my phone to notice if I'm suddenly attacked so that evidence exists even if I couldn't react. As a person harassed by police, I want a private, later-reviewable recording so that I have real proof, not just my word. As a judge, I want to open a link on my own phone and test the trigger myself so that I trust the demo is real. |
| **Success Metrics (for the hackathon)** | Live trigger reliably fires when a judge makes a loud sound or sudden phone motion on their own device; Gemma report generates and displays within a reasonable wait; the story from PRD → demo → writeup is coherent and honest about what's real vs. roadmap. |

---

## 02 — TRD (Technical Requirements Document)

| Field | Detail |
|---|---|
| **Frontend** | Single-page web app — React + Vite, Tailwind CSS. (Plain HTML/JS is also fine if you want zero build step; React only if you're already comfortable with it — don't learn it under time pressure.) |
| **Backend** | Minimal Node/Express server or a single serverless function — its *only* job is proxying calls to the Gemma API so your API key is never exposed in browser JS. |
| **Database** | None needed. Store "trigger packages" client-side in **IndexedDB** (audio/image blobs + metadata) — no persistence server needed for a single-demo hackathon build. |
| **Auth** | None. Single-user local demo — skip entirely, don't build login. |
| **Hosting** | Vercel (frontend + serverless function together) — simplest path to one public HTTPS URL judges can open. **HTTPS is mandatory**: mobile browsers block microphone/motion access on plain HTTP. |
| **Third-party APIs** | Gemma 4 API via Google AI Studio (cloud-hosted). **Important change from earlier plans**: since judges run this on their own phones, you cannot rely on your laptop's local Ollama instance — the report-generation call must hit a real hosted endpoint. |
| **Key Libraries** | Native `Web Audio API` (sound analysis), native `DeviceMotionEvent` (motion), native `SubtleCrypto` (SHA-256 hashing — no library needed), `@google/generative-ai` SDK (Gemma calls) |
| **Environment Variables** | `GEMMA_API_KEY` (server-side only, never sent to the browser) |
| **Hard Constraints** | Must work in a mobile browser with only a link — no install step; must request mic/motion/camera permission explicitly (browsers require a user gesture, e.g. tapping "Start Monitoring," before permission prompts will fire); must degrade gracefully if a judge's browser doesn't support `DeviceMotionEvent` (iOS Safari requires an explicit permission request function, Android Chrome doesn't) |

---

## 03 — App Flow

| Field | Detail |
|---|---|
| **Pages** | `/` (landing + permission request), `/monitor` (live detection screen), `/packages` (list of past trigger packages), `/packages/:id` (package detail + Gemma report) |
| **Navigation Type** | Simple top bar or bottom tabs: **Monitor** \| **Packages** |
| **First Screen** | Plain landing page explaining briefly what the app does, with a single "Start Monitoring" button. Tapping it triggers the mic/motion/camera permission prompts (must happen on a real tap due to browser rules). |
| **Auth Flow** | None — straight from landing to monitoring. |
| **Core User Journey 1** | Judge opens the link → taps "Start Monitoring" → grants permissions → makes a loud sound or shakes the phone → sees a subtle, calm confirmation (not an alarm) that a package was captured. |
| **Core User Journey 2** | Judge taps **Packages** → sees the new entry in the list → opens it → taps "Generate Report" → Gemma's structured summary appears in the same view. |
| **Empty States** | Packages page shows "No trigger packages yet" before any trigger has fired. |
| **Error States** | Permission denied → explain plainly why it's needed, with a retry button. Gemma API call fails → show a retry button, don't crash the view. |
| **Redirects / Interactions** | After a trigger fires, there is **no forced redirect or alarm screen** — this is deliberate, matching the "no visible panic UI" design goal. A small, calm toast or badge is enough; the package simply appears in the list. |

---

## 04 — UI/UX Design Brief

| Field | Detail |
|---|---|
| **Aesthetic** | Deliberately plain and unremarkable — should read as a boring utility app, not a security app. This is a real product requirement, not just style: the whole point is that it doesn't look like something worth taking away from someone. |
| **Primary Color** | Muted neutral — slate grey or soft blue. Avoid red/orange/alarm-coded colors entirely. |
| **Background Color** | Light, plain (e.g. `#FAFAFA`) |
| **Text Color** | Standard dark grey (e.g. `#1A1A1A`) |
| **Accent / CTA Color** | Muted blue (e.g. `#4A6FA5`) — calm, not urgent-looking |
| **Font** | System default / Inter — nothing distinctive |
| **Border Radius** | Small, e.g. 6px — utilitarian, not playful |
| **Shadows** | None or very subtle — flat design reads as more "ordinary app" |
| **Dark/Light Mode** | Light mode primary — looks more like an everyday note-taking or voice-memo app |
| **Reference Apps** | Google Keep, a plain voice recorder app — boring on purpose |
| **Mobile** | Mobile-first, single column, large tap targets for the permission-request button specifically (must be easy to hit on any device size) |
| **Accessibility** | Standard contrast ratios; nothing flashing, no alarm sounds or vibration patterns that would draw attention to the phone |

---

## 05 — Backend Schema

Since there's no server-side database for the MVP, this is the **client-side IndexedDB schema** — the real data model of the app.

| Field | Detail |
|---|---|
| **Store: packages** | `id` (uuid), `trigger_type` ('audio' \| 'motion' \| 'combined'), `confidence_score` (float 0–1), `timestamp_start`, `timestamp_end`, `audio_blob` (Blob), `image_blob` (Blob, optional), `local_hash` (SHA-256 string), `gemma_report` (text, null until generated), `disposition` ('unreviewed' \| 'confirmed' \| 'dismissed') |
| **Relationships** | None — single flat store, single local user |
| **Auth Provider** | None for MVP |
| **Row Level Security** | N/A — all data is local to the browser/device, never leaves it except the single clip sent for report generation |
| **User Roles** | Single implicit user — no roles needed |
| **File/Media Storage** | Audio/image blobs live entirely in IndexedDB on-device; nothing is uploaded or persisted server-side except transiently, during the one API call to generate a report |
| **Sensitive Fields** | Everything (audio, image, location if added later) is sensitive by nature — the schema's core property is that raw evidence never leaves the device except by explicit user action |
| **API Endpoints** | `POST /api/generate-report` — accepts an audio clip, calls the Gemma API server-side, returns the structured text report. This is the only server endpoint needed. |

---

## 06 — Implementation Plan (mapped to 3 days)

| Phase | Goal |
|---|---|
| **Phase 1 — Setup (Day 1, morning)** | Scaffold the web app (Vite + React or plain HTML/JS), get a bare skeleton deployed to Vercel immediately — proving hosting works early removes your biggest late-stage risk. Set `GEMMA_API_KEY` as an env var on the server side only. |
| **Phase 2 — Core Detection (Day 1, afternoon–evening)** | Build the Web Audio API loudness/pitch-spike analyzer and the DeviceMotion spike detector. Combine into one simple weighted score with a threshold. Test live, in a real browser, with real sounds/motion — this is the piece to get right first since everything else depends on it firing correctly. |
| **Phase 3 — Capture + Package (Day 2, morning)** | On trigger: record a short audio clip, take a camera snapshot, compute the SHA-256 hash client-side, save the full package to IndexedDB. Build the Packages list UI. |
| **Phase 4 — Gemma Integration (Day 2, afternoon)** | Build the `/api/generate-report` proxy endpoint, wire the "Generate Report" button in the package detail view, confirm a real Gemma 4 API call returns a usable structured summary. |
| **Phase 5 — Polish (Day 2 evening – Day 3 morning)** | Landing/permission screen, the deliberately calm/plain styling from the UI brief, empty and error states, a pass on mobile responsiveness across a couple of real devices. |
| **Phase 6 — Testing (Day 3, midday)** | Test the full flow end-to-end on at least two different real phones/browsers (iOS Safari and Android Chrome behave differently for motion permissions — test both if you can). Fix permission edge cases. Confirm HTTPS/hosting is stable. |
| **Phase 7 — Deploy + Writeup (Day 3, afternoon)** | Finalize the hosted URL, write the Kaggle writeup honestly separating what's real (this demo) from what's roadmap (background service, SMS, blockchain anchoring), and record a backup demo clip in case live Wi-Fi/mic access fails on stage. |
| **Done Criteria** | A judge can open the URL on their own phone, grant permissions, trigger the detection with a real sound or motion, see a package appear, and tap through to a real Gemma-generated report — no simulation, no crashes, no pre-recorded content anywhere in the path. |
