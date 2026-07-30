/**
 * Vercel Serverless Function: Gemma Multi-Chat Endpoint
 * Handles contextual chat queries with tagged recording context.
 * Uses Gemma 4 (gemma-4-31b-it) for real AI replies when GEMMA_API_KEY is set.
 * Retries with Gemini 2.5 Flash if Gemma endpoint fails.
 * Falls back cleanly to a deterministic local engine otherwise.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });

  const {
    query = '',
    tagged_context = [],
    attachments_count = 0
  } = req.body || {};

  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMMA_API_KEY;
  const gemmaModel = process.env.GEMMA_MODEL || 'gemma-4-31b-it';

  if (!apiKey) {
    console.log('[gemma-chat] No API key — returning local fallback reply.');
    return res.status(200).json({ reply: computeFallbackReply(query, tagged_context) });
  }

  // Build a rich contextual prompt from tagged recordings
  const contextBlock = tagged_context.length > 0
    ? tagged_context.map(rec => `
Recording #${rec.recording_number}:
- Captured: ${rec.started_at || 'Unknown time'}
- Location: ${rec.location || 'Unknown'}
- Events detected: ${(rec.events || []).join(', ') || 'None'}
- Entities: ${(rec.entities || []).join(', ') || 'None'}
- Audio segments saved: ${rec.segment_count || 0}
`).join('\n---\n')
    : 'No specific recordings tagged in this message.';

  const systemPrompt = `You are Gemma, the AI assistant embedded in Amana — a personal safety and evidence preservation app used in Nigeria. 
You help users understand their saved recordings, analyze incidents, and make sense of evidence captured automatically.

Use simple, clear language (Grade 5 level). Be direct and helpful. 
Do NOT make up information that isn't in the recording context.
If asked about something not in the context, say so honestly.

${tagged_context.length > 0
  ? `The user has tagged ${tagged_context.length} recording(s) in this message. Here is the evidence context:\n${contextBlock}`
  : `No recordings are tagged. Respond helpfully and suggest the user tag a recording with / to analyze it.`
}
${attachments_count > 0 ? `\nThe user also attached ${attachments_count} image(s) to this message.` : ''}

User message: "${query}"

Respond in plain text only (no markdown headers, no bullet lists unless helpful). Keep your reply under 4 sentences unless the user asks for detail.`;

  // Step 1: Try Gemma 4 (gemma-4-31b-it)
  try {
    const gemmaRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${gemmaModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 }
        })
      }
    );

    if (gemmaRes.ok) {
      const data = await gemmaRes.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const replyText = cleanGemmaOutput(rawText);
      if (replyText) {
        return res.status(200).json({ reply: replyText });
      }
    }

    // Step 2: Retry with Gemini 2.5 Flash if Gemma endpoint fails
    console.warn(`[gemma-chat] ${gemmaModel} failed (${gemmaRes.status}), retrying with gemini-2.5-flash`);
    const fallbackRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 }
        })
      }
    );

    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      const rawFbText = fbData.candidates?.[0]?.content?.parts?.[0]?.text;
      const fbText = cleanGemmaOutput(rawFbText);
      if (fbText) return res.status(200).json({ reply: fbText });
    }

    return res.status(200).json({ reply: computeFallbackReply(query, tagged_context) });
  } catch (err) {
    console.error('[gemma-chat] Fetch error:', err);
    return res.status(200).json({ reply: computeFallbackReply(query, tagged_context) });
  }
}

/**
 * Strips internal chain-of-thought/scratchpad bullets and extra quotes from AI responses
 */
function cleanGemmaOutput(text) {
  if (!text) return null;

  // Split into lines
  const lines = text.split('\n');
  const cleanLines = lines.filter(line => {
    const trimmed = line.trim();
    // Filter out bullet scratchpad lines
    if (trimmed.startsWith('*') && (
      trimmed.includes('Persona:') ||
      trimmed.includes('Goal:') ||
      trimmed.includes('Language Style:') ||
      trimmed.includes('Constraints:') ||
      trimmed.includes('User Input:') ||
      trimmed.includes('Greeting:') ||
      trimmed.includes('Purpose:') ||
      trimmed.includes('Call to Action:') ||
      trimmed.includes('Simple language?') ||
      trimmed.includes('Direct/Helpful?') ||
      trimmed.includes('No made-up') ||
      trimmed.includes('Suggest tag') ||
      trimmed.includes('Plain text') ||
      trimmed.includes('Under 4 sentences?')
    )) {
      return false;
    }
    return true;
  });

  let result = cleanLines.join('\n').trim();

  // Strip enclosing quotes if present
  if (result.startsWith('"') && result.endsWith('"') && result.length > 2) {
    result = result.slice(1, -1).trim();
  }

  return result || text.trim();
}

/**
 * Local deterministic fallback for when the API is unavailable.
 * Grade 5 vocabulary, based only on tagged context data.
 */
function computeFallbackReply(query, tagged_context) {
  const q = (query || '').toLowerCase();

  if (tagged_context.length === 0) {
    return `I can help you understand your saved recordings. Type / to pick a recording to tag, then ask me your question.`;
  }

  if (tagged_context.length === 1) {
    const rec = tagged_context[0];
    const recNum = rec.recording_number || 1;
    const location = rec.location || 'an unknown location';
    const events = (rec.events || []).join(', ') || 'unusual sound';
    const segCount = rec.segment_count || 0;

    if (q.includes('where') || q.includes('location') || q.includes('place')) {
      return `Saved Recording #${recNum} was captured at ${location}.`;
    }
    if (q.includes('what') || q.includes('happen') || q.includes('sound') || q.includes('hear')) {
      return `In Saved Recording #${recNum}, the following was detected: ${events}. ${segCount} audio clip${segCount !== 1 ? 's' : ''} were saved safely on your phone.`;
    }
    if (q.includes('when') || q.includes('time')) {
      return `Saved Recording #${recNum} was captured on ${rec.started_at ? new Date(rec.started_at).toLocaleString() : 'an unknown date'}.`;
    }

    return `Saved Recording #${recNum} has ${segCount} audio clip${segCount !== 1 ? 's' : ''} from ${location}. Events detected: ${events}.`;
  }

  // Multiple recordings
  const recNums = tagged_context.map(r => `#${r.recording_number || 1}`).join(' and ');
  const totalSegs = tagged_context.reduce((sum, r) => sum + (r.segment_count || 0), 0);

  if (q.includes('compare') || q.includes('difference') || q.includes('both')) {
    return `Recordings ${recNums} were both saved on your phone. Together they contain ${totalSegs} audio clips. Each recording captured events from different times and places.`;
  }

  return `I looked through Recordings ${recNums}. Together they have ${totalSegs} audio clips saved safely on your phone.`;
}
