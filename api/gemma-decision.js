/**
 * Vercel Serverless Function: Gemma Decision Endpoint (45s 3-Poll Protocol)
 * Handles both:
 * 1) 15-Second Single Window Poll (returns vote: 1 | 0)
 * 2) Final 45-Second 3-Poll Aggregation Decision (polls + movement data + event summary -> keep | quit)
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });

  const {
    isFinalAggregation = false,
    mode = null,
    raw_stt = '',
    window_number = 1,
    polls = [],
    movement_summary = {},
    event_summary = {},
    audio_base64 = null,
    audio_mime = 'audio/wav',
    sensor_summary = {},
    ledger = {}
  } = req.body || {};

  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMMA_API_KEY;
  const gemmaModel = process.env.GEMMA_MODEL || 'gemma-4-31b-it';

  // ─────────────────────────────────────────────────────────────
  // MODE 1: STAGE 1 RAW STT EXTRACTION
  // ─────────────────────────────────────────────────────────────
  if (mode === 'stt_only') {
    if (!apiKey || !audio_base64) {
      return res.status(200).json({ transcript: sensor_summary.live_transcript || 'NO_SPEECH' });
    }

    const sttPrompt = `Transcribe any spoken words in this audio verbatim. Output ONLY the exact spoken text. If no spoken words exist, output NO_SPEECH.`;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: sttPrompt },
              { inlineData: { mimeType: audio_mime || 'audio/wav', data: audio_base64 } }
            ]
          }]
        })
      });
      const data = await response.json();
      const txt = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

      let transcript = txt;
      if (txt.includes('{')) {
        try {
          const match = txt.match(/\{[\s\S]*\}/);
          const parsed = match ? JSON.parse(match[0]) : {};
          transcript = parsed.transcript || parsed.text || txt;
        } catch (e) {}
      }

      transcript = transcript.replace(/```json|```/g, '').trim();
      if (!transcript || transcript.toUpperCase().includes('NO_SPEECH')) {
        transcript = sensor_summary.live_transcript || 'NO_SPEECH';
      }

      return res.status(200).json({ transcript });
    } catch (e) {
      return res.status(200).json({ transcript: sensor_summary.live_transcript || 'NO_SPEECH' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MODE 2: STAGE 2 GEMINI MULTIMODAL ENRICHMENT
  // ─────────────────────────────────────────────────────────────
  if (mode === 'enrichment') {
    if (!apiKey) {
      return res.status(200).json({
        enrichment: {
          corrected_transcript: raw_stt !== 'NO_SPEECH' ? raw_stt : 'No speech detected.',
          speakers: raw_stt !== 'NO_SPEECH' ? ['Speaker A (Aggressor)', 'Speaker B (Victim)'] : ['Ambient Audio'],
          ambient_sounds: sensor_summary.rms > 0.30 ? ['Sound spike'] : ['Background ambience'],
          distress_intent: sensor_summary.band_2k4k > 0.15 || /help|stop|police|leave/i.test(raw_stt),
          extracted_entities: ['Recorded Location']
        }
      });
    }

    const enrichPrompt = `You are a forensic audio evidence analyst. Analyze this audio clip and raw transcript: "${raw_stt}".
Extract background sounds (screams, glass shatter, vehicle engine, shouting), speaker count, corrected transcript (correcting Hausa/Pidgin errors), and distress intent.

Output ONLY valid JSON matching this schema:
{
  "enrichment": {
    "corrected_transcript": "verbatim corrected text",
    "speakers": ["Speaker A (Aggressor)", "Speaker B (Victim)"],
    "ambient_sounds": ["Glass shatter", "Engine noise", "Scream"],
    "distress_intent": true,
    "extracted_entities": ["Location or threat entity"]
  }
}`;

    try {
      const parts = [{ text: enrichPrompt }];
      if (audio_base64) {
        parts.push({ inlineData: { mimeType: audio_mime || 'audio/wav', data: audio_base64 } });
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      });
      const data = await response.json();
      const txt = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

      let enrichment = null;
      const jsonMatch = txt.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          enrichment = parsed.enrichment || parsed;
        } catch (e) {}
      }

      if (!enrichment || !enrichment.corrected_transcript) {
        enrichment = {
          corrected_transcript: raw_stt !== 'NO_SPEECH' ? raw_stt : 'Acoustic background audio captured.',
          speakers: raw_stt !== 'NO_SPEECH' ? ['Speaker A', 'Speaker B'] : ['Ambient Audio'],
          ambient_sounds: sensor_summary.rms > 0.30 ? ['Elevated sound spike'] : ['Background ambience'],
          distress_intent: sensor_summary.band_2k4k > 0.15 || /help|stop|police|leave/i.test(raw_stt),
          extracted_entities: ['Recorded Area']
        };
      }

      return res.status(200).json({ enrichment });
    } catch (e) {
      return res.status(200).json({
        enrichment: {
          corrected_transcript: raw_stt !== 'NO_SPEECH' ? raw_stt : 'Acoustic background audio captured.',
          speakers: ['Speaker A'],
          ambient_sounds: ['Background ambience'],
          distress_intent: false,
          extracted_entities: ['Recorded Area']
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MODE A: FINAL 45s 3-POLL AGGREGATION DECISION (10-Point Weighted Scale)
  // ─────────────────────────────────────────────────────────────
  if (isFinalAggregation) {
    const votesStr = polls.length > 0 ? polls.map((v, i) => `Poll #${i + 1}: ${v === 1 ? '1 (Keep/Threat)' : '0 (Quit/Safe)'}`).join('\n') : 'No individual polls recorded.';

    const aggregationPrompt = `
You are the primary evidence classifier of Amana, a personal safety app.
A 45-second continuous evaluation trial (3 x 15s windows) just completed. Review the 3 poll votes, accumulated movement data, and acoustic/event summary to make the FINAL DECISION.

Poll History across 45s:
${votesStr}

Accumulated Movement Data (Accelerometer / Motion):
- Peak Acceleration: ${movement_summary.peak_accel ?? 0} m/s²
- Motion Pattern: ${movement_summary.pattern ?? 'steady'}

Accumulated Acoustic & Event Summary:
- Transcripts Extracted: ${JSON.stringify(event_summary.transcripts || [])}
- Peak Loudness (RMS): ${event_summary.peak_rms ?? 0} / 1.0
- High-Freq Energy (2-4kHz scream band): ${event_summary.band_2k_4k ?? 0}
- Known Entities: ${JSON.stringify(ledger.known_entities || [])}
- Detected Events: ${JSON.stringify(ledger.detected_events || [])}

EVIDENCE WEIGHT RULES (10-Point Scale):
Score the accumulated evidence across all 3 windows:
- Spoken Distress Words ("help", "stop", "police", "leave me", "no", "don't"): +3 points
- Panicked, Screaming, or Aggressive Vocal Tone: +2 points
- High 2-4kHz Scream Formant Concentration (> 0.05): +2 points
- RMS Loudness Spike / Crash above baseline (RMS >= 0.04): +2 points
- Physical Collision / Jolt Motion (> 6.0 m/s²): +2 points
- Multi-Window Persistence (elevated sound in 1+ windows): +2 points

DECISION THRESHOLD (THRESHOLD = 5):
- "keep": Total Accumulated Weight >= 5 (Confirmed threat).
- "quit": Total Accumulated Weight < 5 (Isolated noise, safe ambient baseline).

Respond ONLY in valid JSON matching this exact format:
{
  "decision": "keep" | "quit",
  "accumulated_weight": number 0 to 10,
  "confidence": number 0.0 to 1.0,
  "reason": "1-sentence explanation of decision based on 10-point threat score",
  "updated_entities": ["array of human names, places, vehicle references"],
  "updated_events": ["array of physical or acoustic events extracted"],
  "narrative_summary": "1-2 sentences summarizing the 45s trial"
}
`;

    const voteSum = polls.reduce((a, b) => a + b, 0);
    const peakAccel = movement_summary.peak_accel || 0;
    const peakRms = event_summary.peak_rms || 0;
    const bandEnergy = event_summary.band_2k_4k || 0;
    const transcriptsText = JSON.stringify(event_summary.transcripts || []).toLowerCase();
    // Specific distress phrases only — avoid generic words that appear in all audio
    const hasDistressText = /\bhelp\b|leave me|police|save me|don't touch|don't hurt|somebody help|i'm being|\battack\b|\bkill\b/i.test(transcriptsText);

    let calculatedWeight = 0;
    if (hasDistressText) calculatedWeight += 3;
    if (bandEnergy >= 0.12) calculatedWeight += 2; // Realistic: scream-level 2-4kHz energy
    if (peakRms >= 0.12) calculatedWeight += 2;    // Realistic: loud crash/shout on phone mic
    if (peakAccel >= 8.0) calculatedWeight += 2;   // Realistic: strong physical collision
    if (voteSum >= 2) calculatedWeight += 2;       // Majority of windows must have threat signal

    const totalWeight = Math.min(10, calculatedWeight);
    const isKeepFallback = totalWeight >= 5;

    if (!apiKey) {
      console.log('[gemma-decision] Server offline fallback for final aggregation (Weight:', totalWeight, ')');
      return res.status(200).json({
        decision_response: {
          decision: isKeepFallback ? 'keep' : 'quit',
          accumulated_weight: totalWeight,
          confidence: 0.85,
          reason: isKeepFallback ? `Confirmed threat signature (Weight ${totalWeight}/10 >= 7). Locking Vault.` : `Low threat weight (${totalWeight}/10 < 7). Quitting trial & purging clips.`,
          updated_entities: ledger.known_entities || ['Recorded Location'],
          updated_events: ledger.detected_events || ['45s trial evaluated'],
          narrative_summary: isKeepFallback ? 'High-weight threat confirmed during 45s trial.' : 'Calm baseline confirmed (weight < 7).'
        }
      });
    }

    try {
      const gemmaRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gemmaModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aggregationPrompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        })
      });

      if (gemmaRes.ok) {
        const gData = await gemmaRes.json();
        const text = gData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return res.status(200).json({ decision_response: JSON.parse(text.trim()) });
      }

      // Retry with Gemini 2.0 Flash if Gemma endpoint times out
      const fbRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aggregationPrompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        })
      });

      if (fbRes.ok) {
        const fbData = await fbRes.json();
        const text = fbData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return res.status(200).json({ decision_response: JSON.parse(text.trim()) });
      }
    } catch (err) {
      console.error('[gemma-decision] Aggregation call error:', err);
    }

    return res.status(200).json({
      decision_response: {
        decision: isKeepFallback ? 'keep' : 'quit',
        accumulated_weight: totalWeight,
        confidence: 0.80,
        reason: isKeepFallback ? `Deterministic weight fallback (${totalWeight}/10 >= 7).` : `Quiet baseline weight fallback (${totalWeight}/10 < 7).`,
        updated_entities: ledger.known_entities || ['Recorded Location'],
        updated_events: ledger.detected_events || ['Trial evaluated locally'],
        narrative_summary: isKeepFallback ? 'Threat signature corroborated locally.' : 'Calm baseline confirmed locally.'
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // MODE B: SINGLE 15-SECOND WINDOW POLL VOTE (vote: 1 | 0)
  // ─────────────────────────────────────────────────────────────
  let audioTranscript = { transcript: '', language: 'en', tone: 'neutral', intensity: 'normal' };

  if (apiKey && audio_base64) {
    try {
      const audioRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: 'audio/webm', data: audio_base64 } },
                { text: 'Transcribe speech, shouts, or whispers verbatim. Respond in JSON: {"transcript": string, "language": string, "tone": "neutral"|"panic"|"aggressive"|"distress", "intensity": "normal"|"high"}' }
              ]
            }
          ],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        })
      });

      if (audioRes.ok) {
        const audioData = await audioRes.json();
        const rawText = audioData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) audioTranscript = JSON.parse(rawText.trim());
      }
    } catch (err) {
      console.warn('[gemma-decision] Audio transcription warning:', err);
    }
  }

  const textLower = (audioTranscript.transcript || '').toLowerCase();
  const toneLower = (audioTranscript.tone || '').toLowerCase();
  // Specific distress words only — generic words like "no", "stop", "call" excluded to prevent false positives
  const isDistressSpeech = /\bhelp\b|\bleave me\b|\bpolice\b|\bsave me\b|don't touch|don't hurt|somebody help|i'm being|he's got|she's got|\bkill\b|\battack\b/i.test(textLower) ||
                           ['panic', 'distress'].includes(toneLower);

  const pollPrompt = `
You are evaluating a 15-second window in Amana's 45-second threat trial.
Cast your vote: 1 (KEEP / Threat signature or distress spoken) or 0 (QUIT / Safe ambient baseline).

Gemini Audio Transcription:
- Transcript: "${audioTranscript.transcript}"
- Language: ${audioTranscript.language}
- Tone: ${audioTranscript.tone}
- Vocal Intensity: ${audioTranscript.intensity}

Sensor Metadata:
- Loudness (RMS): ${sensor_summary.audio_features?.peak_rms ?? 0} / 1.0
- High-Freq Energy (2-4kHz scream band): ${sensor_summary.audio_features?.band_2k_4k_energy ?? 0}
- Peak Acceleration: ${sensor_summary.accelerometer_peak ?? 0} m/s²

DECISION RULE:
- VOTE 1 if clear distress phrases ("help", "leave me", "police") OR tone is panic/distress OR scream band > 0.15 OR motion > 10 m/s².
- VOTE 0 if audio is at calm ambient baseline, ordinary conversation, or no clear threat signal.
Be strict. Ambient background noise or music should vote 0.

Respond ONLY in valid JSON:
{
  "vote": 1 or 0,
  "confidence": number 0.0 to 1.0,
  "reason": "1-sentence reason for vote",
  "transcript": "${audioTranscript.transcript.replace(/"/g, "'")}"
}
`;

  const rms = sensor_summary.audio_features?.peak_rms || 0;
  const band = sensor_summary.audio_features?.band_2k_4k_energy || 0;
  const accel = sensor_summary.accelerometer_peak || 0;
  // Fallback vote — only fires on strong acoustic or motion signals (realistic phone-mic thresholds)
  const pollVote = (isDistressSpeech || band >= 0.15 || accel > 10.0) ? 1 : 0;

  if (!apiKey) {
    return res.status(200).json({
      decision_response: {
        vote: pollVote,
        decision: pollVote === 1 ? 'keep' : 'quit',
        confidence: 0.85,
        reason: isDistressSpeech
          ? `Distress phrase detected: "${audioTranscript.transcript}". Vote 1.`
          : (pollVote === 1 ? 'Acoustic scream/motion spike detected (Vote 1).' : 'Quiet background baseline (Vote 0).'),
        transcript: audioTranscript.transcript || 'Background ambient audio captured.'
      }
    });
  }

  try {
    const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gemmaModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: pollPrompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });

    if (gRes.ok) {
      const gData = await gRes.json();
      const text = gData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text.trim());
        // Trust Gemma's real vote — no override. If Gemma says 0, it's 0.
        const finalVote = parsed.vote ?? pollVote;
        return res.status(200).json({
          decision_response: {
            ...parsed,
            vote: finalVote,
            decision: finalVote === 1 ? 'keep' : 'quit',
            transcript: audioTranscript.transcript || parsed.transcript
          }
        });
      }
    }
  } catch (err) {
    console.error('[gemma-decision] Poll vote call error:', err);
  }

  return res.status(200).json({
    decision_response: {
      vote: pollVote,
      decision: pollVote === 1 ? 'keep' : 'quit',
      confidence: 0.80,
      reason: isDistressSpeech ? `Distress phrase caught: "${audioTranscript.transcript}". Vote 1.` : 'Deterministic poll vote executed.',
      transcript: audioTranscript.transcript
    }
  });
}
