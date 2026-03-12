/**
 * ADDITIUM 3D – Email Notification Proxy (Vercel Serverless Function)
 * -------------------------------------------------------------------
 * Sends an email notification via Resend API when new data is detected.
 * Requires RESEND_API_KEY environment variable set in Vercel project settings.
 *
 * Endpoint: POST /api/notify-email
 * Body: { icon, title, msg }
 */

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured in Vercel environment variables' });

    // Vercel may pass body as string or object depending on runtime version
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { icon = '🔔', title = 'Notification', msg = '', to } = body;
    const toEmail = (typeof to === 'string' && to.includes('@')) ? to : (process.env.NOTIFY_EMAIL || '');
    if (!toEmail) return res.status(400).json({ error: 'No recipient email provided' });
    const timestamp = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:#0f172a;padding:20px 24px;display:flex;align-items:center;gap:12px">
      <span style="font-size:24px">${icon}</span>
      <span style="color:#fff;font-weight:700;font-size:16px;letter-spacing:0.05em">ADDITIUM 3D DASHBOARD</span>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px">${title}</h2>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">${msg}</p>
    </div>
    <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <small style="color:#94a3b8;font-size:11px;font-family:monospace">${timestamp}</small>
    </div>
  </div>
</body>
</html>`;

    try {
        const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Additium Dashboard <notifications@flcr.my.id>',
                to: [toEmail],
                subject: `[Additium] ${title}`,
                html,
            }),
        });

        const data = await r.json();
        if (!r.ok) {
            const detail = data?.message || data?.name || JSON.stringify(data);
            console.error('[notify-email] Resend error:', detail);
            return res.status(502).json({ error: detail });
        }
        return res.status(200).json({ ok: true, id: data.id });
    } catch (err) {
        console.error('[notify-email] Fetch error:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
