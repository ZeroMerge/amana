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
    attachments = [],
    attachments_count = 0
  } = req.body || {};

  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMMA_API_KEY;
  const primaryModel = process.env.GEMMA_MODEL || 'gemma-4-31b-it';

  if (!apiKey) {
    console.log('[gemma-chat] No API key — returning local fallback reply.');
    return res.status(200).json({ reply: computeFallbackReply(query, tagged_context, attachments) });
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

  const systemPrompt = `You are Gemma, the AI assistant embedded in Amana — a personal safety and evidence preservation app in Nigeria.
You help users understand their saved recordings, analyze incidents, examine photo attachments, and answer safety questions.

Context Details:
${tagged_context.length > 0
  ? `Tagged Recordings Context:\n${contextBlock}`
  : `No recordings tagged.`
}
${attachments.length > 0 ? `Attachments: ${attachments.length} image(s) attached.` : ''}

User Query: "${query}"

CRITICAL OUTPUT FORMAT RULE:
You MUST respond ONLY with a single valid JSON object containing your final response string.
Do NOT include internal notes, thinking steps, bullet lists, or text outside the JSON.

Required JSON Schema:
{
  "reply": "Your clean response to the user in 1 to 3 simple sentences."
}`;

  // Build multimodal content parts
  const contentsParts = [{ text: systemPrompt }];

  // Add base64 image parts if present
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att.data_base64) {
        contentsParts.push({
          inlineData: {
            mimeType: att.mime || 'image/jpeg',
            data: att.data_base64.replace(/^data:image\/\w+;base64,/, '')
          }
        });
      }
    }
  }

  // Step 1: Try Primary Model (gemini-2.0-flash / gemma-2-27b-it)
  try {
    const gemmaRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: contentsParts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 512
          }
        })
      }
    );

    if (gemmaRes.ok) {
      const data = await gemmaRes.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const replyText = parseGemmaJsonResponse(rawText);
      if (replyText) {
        return res.status(200).json({ reply: replyText });
      }
    }

    // Step 2: Retry with gemini-1.5-flash if primary endpoint fails
    console.warn(`[gemma-chat] ${primaryModel} failed (${gemmaRes.status}), retrying with gemini-1.5-flash`);
    const fallbackRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: contentsParts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 512
          }
        })
      }
    );

    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      const rawFbText = fbData.candidates?.[0]?.content?.parts?.[0]?.text;
      const fbText = parseGemmaJsonResponse(rawFbText);
      if (fbText) return res.status(200).json({ reply: fbText });
    }

    return res.status(200).json({ reply: computeFallbackReply(query, tagged_context, attachments) });
  } catch (err) {
    console.error('[gemma-chat] Fetch error:', err);
    return res.status(200).json({ reply: computeFallbackReply(query, tagged_context, attachments) });
  }
}

/**
 * Parses JSON response from Gemma 4 API and extracts the clean "reply" field
 */
function parseGemmaJsonResponse(rawText) {
  if (!rawText) return null;

  try {
    // Strip markdown code fences if model wrapped response in ```json ... ```
    let clean = rawText.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed.reply === 'string' && parsed.reply.trim()) {
      return parsed.reply.trim();
    }
  } catch (err) {
    console.warn('[gemma-chat] JSON parse fallback on rawText:', err);
  }

  // Fallback extraction if JSON parsing failed
  const match = rawText.match(/"reply"\s*:\s*"([\s\S]*?)"/i);
  if (match && match[1]) {
    return match[1].replace(/\\"/g, '"').trim();
  }

  return null;
}

/**
 * Local deterministic fallback for when the API is unavailable.
 * Grade 5 vocabulary, based on query intent & tagged context data.
 */
function computeFallbackReply(query, tagged_context, attachments = []) {
  const q = (query || '').toLowerCase().trim();

  // Image analysis questions
  if (q.includes('image') || q.includes('photo') || q.includes('picture') || q.includes('camera')) {
    if (attachments.length > 0) {
      return `I see your uploaded photo attachment. I will inspect the image for visual details, location signs, and evidence.`;
    }
    return `Yes! I can analyze images. Tap the photo icon to upload a picture or tag a recording with an image attached.`;
  }

  // Common conversational queries
  if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q === 'gemma') {
    return `Hello! I am Gemma, your personal safety assistant. Ask me anything or tag a recording with / to start analyzing.`;
  }
  if (q.includes('didn\'t answer') || q.includes('didnt answer') || q.includes('no answer') || q.includes('respond')) {
    return `Apologies for the delay! I am right here. Ask me any question or tag a recording using / so I can help.`;
  }
  if (q.includes('who are you') || q.includes('what can you do') || q.includes('help')) {
    return `I am Gemma, AI assistant for Amana. I help you understand your saved audio recordings, examine photo evidence, and answer incident questions.`;
  }

  if (tagged_context.length === 0) {
    return `I am ready to help! Ask me any question, attach a photo, or type / to tag a saved recording for analysis.`;
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
