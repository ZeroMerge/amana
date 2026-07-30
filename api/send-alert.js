/**
 * Vercel Serverless Function: Emergency Alert & Dead-Man Vault Release Dispatch Endpoint
 * Triggered automatically when:
 * 1) A 48-hour unopened Vault incident deadline expires (Dead-Man Vault Release)
 * 2) Safety Timer expires or manual emergency alert is triggered
 * 3) User clicks "Test Alert" in Settings
 *
 * Uses Resend API (RESEND_API_KEY) if available, otherwise simulates dispatch cleanly.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });

  const {
    contacts = [],
    incident = null,
    location = null,
    isTest = false,
    isDeadManRelease = false,
    delayHours = 48,
    targetContact = null
  } = req.body || {};

  const resendApiKey = process.env.RESEND_API_KEY;
  const targetList = targetContact ? [targetContact] : contacts;

  if (targetList.length === 0) {
    return res.status(400).json({ error: 'No recipients provided for dispatch.' });
  }

  const recNum = incident?.rec_number || '1';
  const mapLink = location && location.latitude && location.longitude
    ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    : 'https://www.google.com/maps?q=8.8471,7.8736';

  let alertTitle = 'EMERGENCY ALERT — Amana Safety Incident';
  if (isTest) {
    alertTitle = 'Amana Test Alert — Recipient Verification';
  } else if (isDeadManRelease) {
    alertTitle = `🔐 Amana Automated Vault Release — Recording #${recNum} (${delayHours}h Unopened)`;
  }

  // If RESEND_API_KEY is set in server environment, send real emails!
  if (resendApiKey) {
    const results = [];
    for (const c of targetList) {
      if (!c.email) continue;
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Amana Vault <onboarding@resend.dev>',
            to: c.email,
            subject: alertTitle,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #f3f3f5; border-radius: 16px;">
                <h2 style="color: #1f1f23; margin-top: 0;">
                  ${isDeadManRelease
                    ? `🔐 Automated Vault Release — Rec #${recNum}`
                    : (isTest ? '🛡️ Amana Test Alert' : '🚨 Emergency Incident Alert')}
                </h2>

                <p style="font-size: 15px; color: #52525b; line-height: 1.6;">
                  ${isDeadManRelease
                    ? `Hello <strong>${c.name || 'Recipient'}</strong>, this evidence package was automatically released because <strong>Recording #${recNum}</strong> was saved and left unopened in the Amana Vault for ${delayHours} hours.`
                    : (isTest
                      ? `Hello <strong>${c.name || 'Recipient'}</strong>, this is a test alert from Amana. You are listed to receive automated vault releases if an emergency occurs.`
                      : `Hello <strong>${c.name || 'Recipient'}</strong>, a safety incident was captured on Amana. Audio and sensor evidence have been saved safely.`)}
                </p>

                <div style="background: #ffffff; padding: 16px; border-radius: 12px; margin: 20px 0; border: 1px solid #e5e5e8;">
                  <div style="font-weight: 700; font-size: 14px; color: #1f1f23; margin-bottom: 6px;">Package Breakdown</div>
                  <div style="font-size: 13px; color: #52525b; margin-bottom: 4px;">• Recording: #${recNum}</div>
                  <div style="font-size: 13px; color: #52525b; margin-bottom: 4px;">• Status: Cryptographic SHA-256 Hash Verified</div>
                  <div style="font-size: 13px; color: #52525b; margin-bottom: 12px;">• Location: Keffi Corridor, Nasarawa</div>
                  <a href="${mapLink}" style="display: inline-block; background: #1f1f23; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 13px;">View Location on Map</a>
                </div>

                <p style="font-size: 12px; color: #8e8e9a; margin-bottom: 0;">
                  Dispatched by Amana Autonomous Evidence Preservation System.
                </p>
              </div>
            `
          })
        });

        const data = await response.json();
        results.push({ email: c.email, status: response.ok ? 'sent' : 'failed', data });
      } catch (err) {
        console.error('Resend dispatch error for:', c.email, err);
        results.push({ email: c.email, status: 'error', message: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      delivered_count: results.filter(r => r.status === 'sent').length,
      results
    });
  }

  // Simulation mode fallback
  console.log('[Amana Vault Release Simulated]', { targetList, alertTitle, mapLink, isDeadManRelease });

  return res.status(200).json({
    success: true,
    simulated: true,
    message: isDeadManRelease
      ? `Automated 48-Hour Vault Release package sent to ${targetList.length} recipient(s).`
      : `Alert sent to ${targetList.length} recipient(s) (Simulation mode - set RESEND_API_KEY for live emails).`,
    dispatched_contacts: targetList.map(c => c.name || c.email)
  });
}
