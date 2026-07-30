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
  // MODE A: FINAL 90s 3-POLL AGGREGATION DECISION
  // ─────────────────────────────────────────────────────────────
  if (isFinalAggregation) {
    const votesStr = polls.length > 0 ? polls.map((v, i) => `Poll #${i + 1}: ${v === 1 ? '1 (Keep/Threat)' : '0 (Quit/Safe)'}`).join('\n') : 'No individual polls recorded.';

    const aggregationPrompt = `
You are the primary evidence classifier of Amana, a personal safety app used in Nigeria.
A 90-second continuous evaluation trial just completed. Review the 3 poll votes, accumulated movement data, and acoustic/event summary to make the FINAL DECISION.

Poll History across 90s:
${votesStr}

Accumulated Movement Data (Accelerometer / Motion):
- Peak Acceleration: ${movement_summary.peak_accel ?? 0} m/s²
- Motion Pattern: ${movement_summary.pattern ?? 'steady'}

Accumulated Acoustic & Event Summary:
- Transcripts Extracted: ${JSON.stringify(event_summary.transcripts || [])}
- Peak Loudness (RMS): ${event_summary.peak_rms ?? 0.5} / 1.0
- High-Freq Energy (2-4kHz scream band): ${event_summary.band_2k_4k ?? 0.2}
- Known Entities: ${JSON.stringify(ledger.known_entities || [])}
- Detected Events: ${JSON.stringify(ledger.detected_events || [])}

DECISION RULES:
- "keep": Confirm threat if 2+ polls voted 1, OR if high movement (accel > 12m/s²), distress shouts, or aggressive speech was detected.
- "quit": Quit and delete trial clips if ambient sound returned to calm/safe baseline (majority 0 votes and low motion).

Respond ONLY in valid JSON matching this exact format:
{
  "decision": "keep" | "quit",
  "confidence": number 0.0 to 1.0,
  "reason": "1-sentence explanation of decision based on votes and movement",
  "updated_entities": ["array of human names, places, vehicle references"],
  "updated_events": ["array of physical or acoustic events extracted"],
  "narrative_summary": "1-2 sentences summarizing the 90s trial"
}
`;

    if (!apiKey) {
      console.log('[gemma-decision] Server offline fallback for final aggregation.');
      const voteSum = polls.reduce((a, b) => a + b, 0);
      const isKeep = voteSum >= 2 || (movement_summary.peak_accel > 12);
      return res.status(200).json({
        decision_response: {
          decision: isKeep ? 'keep' : 'quit',
          confidence: 0.85,
          reason: isKeep ? 'Threat confirmed by poll votes & motion.' : 'Safe ambient baseline confirmed.',
          updated_entities: ledger.known_entities || [],
          updated_events: ledger.detected_events || ['90s trial evaluated'],
          narrative_summary: isKeep ? 'High noise/motion detected during 90s trial.' : 'Calm background sound confirmed.'
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

      // Retry with Gemini 2.5 Flash if Gemma endpoint times out
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

    // Safety-First Offline Fallback (Default to KEEP if API call fails)
    return res.status(200).json({
      decision_response: {
        decision: 'keep',
        confidence: 0.80,
        reason: 'Safety-first fallback applied due to network timeout.',
        updated_entities: ledger.known_entities || [],
        updated_events: ledger.detected_events || ['Trial evaluated locally'],
        narrative_summary: 'Safety-first fallback engaged during 90s trial.'
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // MODE B: SINGLE 30-SECOND WINDOW POLL VOTE (vote: 1 | 0)
  // ─────────────────────────────────────────────────────────────

  // Step 1: Audio Transcription via Gemini 2.5 Flash
  let audioTranscript = {
    transcript: 'No audible speech detected in segment.',
    language: 'English/Unknown',
    tone: 'Neutral',
    voices: 1,
    commands_detected: [],
    intensity: 0.5
  };

  if (audio_base64 && apiKey) {
    try {
      const transcriptionPrompt = `
Analyze this 30-second distress audio clip from a personal safety event.
Extract verbatim speech/whispers/shouts, identify language/dialect (e.g. Hausa, Pidgin, Yoruba, English), emotional tone, speaker count, and any aggressive commands.

Respond ONLY in valid JSON:
{
  "transcript": "verbatim text of spoken words or description of acoustic background",
  "language": "detected language or dialect",
  "tone": "Aggressive | Panic | Neutral | Distress | Calm",
  "voices": number of distinct voices detected,
  "commands_detected": ["array of commands or threats issued"],
  "intensity": number 0.0 to 1.0
}
`;

      const audioRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: audio_mime, data: audio_base64 } },
                { text: transcriptionPrompt }
              ]
            }
          ],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
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

  // Step 2: Individual Poll Vote Reasoning via Gemma 4
  const pollPrompt = `
You are evaluating a 30-second window in Amana's 90-second threat trial.
Cast your vote: 1 (KEEP / Threat signature present) or 0 (QUIT / Safe ambient baseline).

Gemini Audio Transcription:
- Transcript: "${audioTranscript.transcript}"
- Language: ${audioTranscript.language}
- Tone: ${audioTranscript.tone}
- Vocal Intensity: ${audioTranscript.intensity}

Sensor Metadata:
- Loudness (RMS): ${sensor_summary.audio_features?.peak_rms ?? 0.5} / 1.0
- High-Freq Energy (2-4kHz scream band): ${sensor_summary.audio_features?.band_2k_4k_energy ?? 0.2}
- Peak Acceleration: ${sensor_summary.accelerometer_peak ?? 0} m/s²

Respond ONLY in valid JSON:
{
  "vote": 1 or 0,
  "confidence": number 0.0 to 1.0,
  "reason": "1-sentence reason for vote",
  "transcript": "${audioTranscript.transcript.replace(/"/g, "'")}"
}
`;

  if (!apiKey) {
    const rms = sensor_summary.audio_features?.peak_rms || 0.3;
    const accel = sensor_summary.accelerometer_peak || 0;
    const vote = (rms > 0.18 || accel > 8.0) ? 1 : 0;

    return res.status(200).json({
      decision_response: {
        vote,
        decision: vote === 1 ? 'keep' : 'quit',
        confidence: 0.85,
        reason: vote === 1 ? 'Acoustic RMS sound spike detected (Vote 1).' : 'Quiet background baseline (Vote 0).',
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
        return res.status(200).json({
          decision_response: {
            ...parsed,
            decision: parsed.vote === 1 ? 'keep' : 'quit'
          }
        });
      }
    }
  } catch (err) {
    console.error('[gemma-decision] Poll vote call error:', err);
  }

  // Safety-first fallback for single poll: if RMS > 0.35 or accel > 12, vote 1, else 0
  const rms = sensor_summary.audio_features?.peak_rms || 0.4;
  const accel = sensor_summary.accelerometer_peak || 0;
  const fbVote = (rms > 0.35 || accel > 12.0) ? 1 : 0;

  return res.status(200).json({
    decision_response: {
      vote: fbVote,
      decision: fbVote === 1 ? 'keep' : 'quit',
      confidence: 0.80,
      reason: 'Safety fallback poll vote executed.',
      transcript: audioTranscript.transcript
    }
  });
}
