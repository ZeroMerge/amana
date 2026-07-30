/**
 * Vercel Serverless Function: Gemma Decision Endpoint (90s 3-Poll Protocol)
 * Handles both:
 * 1) 30-Second Single Window Poll (returns vote: 1 | 0)
 * 2) Final 90-Second 3-Poll Aggregation Decision (polls + movement data + event summary -> keep | quit)
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
    polls = [],
    movement_summary = {},
    event_summary = {},
    audio_base64 = null,
    audio_mime = 'audio/webm',
    sensor_summary = {},
    ledger = {}
  } = req.body || {};

  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMMA_API_KEY;
  const gemmaModel = process.env.GEMMA_MODEL || 'gemma-4-31b-it';

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
- Spoken Distress Words ("help", "stop", "police", "leave me", "no"): +3 points
- Panicked, Screaming, or Aggressive Vocal Tone: +2 points
- High 2-4kHz Scream Formant Concentration (> 0.20): +2 points
- RMS Loudness Spike above baseline (deviation >= 2.5x): +1 point
- Physical Collision / Jolt Motion (> 12 m/s²): +2 points
- Multi-Window Persistence (elevated sound in 2+ windows): +1 point

DECISION THRESHOLD (THRESHOLD = 7):
- "keep": Total Accumulated Weight >= 7 (Confirmed threat).
- "quit": Total Accumulated Weight < 7 (Isolated noise, safe ambient baseline, low evidence).

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
    const hasDistressText = /help|stop|no|leave|police|save|don't|dont|kill|threat/i.test(transcriptsText);

    let calculatedWeight = 0;
    if (hasDistressText) calculatedWeight += 3;
    if (bandEnergy >= 0.20) calculatedWeight += 2;
    if (peakRms >= 0.15) calculatedWeight += 1;
    if (peakAccel >= 12.0) calculatedWeight += 2;
    if (voteSum >= 2) calculatedWeight += 2; // Multi-window vote persistence

    const totalWeight = Math.min(10, calculatedWeight);
    const isKeepFallback = totalWeight >= 7;

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
  const isDistressSpeech = /help|stop|no|leave|save|police|scream|shout|don't|dont|kill|threat/i.test(textLower) ||
                           ['aggressive', 'panic', 'distress'].includes(toneLower);

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
- VOTE 1 if distress words ("help", "stop", "leave me", shouting) or high scream band (> 0.20) or motion (> 12m/s²) are present.
- VOTE 0 if audio is at calm ambient baseline.

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
  const pollVote = (isDistressSpeech || band >= 0.20 || (rms > 0.15 && accel > 8.0) || accel > 12.0) ? 1 : 0;

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
        const finalVote = isDistressSpeech ? 1 : (parsed.vote ?? pollVote);
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
