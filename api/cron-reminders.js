/**
 * ADDITIUM 3D – Cron Reminders (Vercel Serverless Function)
 * ----------------------------------------------------------
 * Runs daily at 06:00 UTC (07:00 Madrid winter / 08:00 summer).
 * Configured in vercel.json under "crons".
 *
 * Sends:
 *   - Deadline reminders to each worker (tasks due today / tomorrow)
 *   - Weekly task summary to NOTIFY_EMAIL every Monday
 *
 * Requires env vars: RESEND_API_KEY, NOTIFY_EMAIL, CRON_SECRET
 */

const https = require('https');

const SPREADSHEET_BASE =
    'https://docs.google.com/spreadsheets/d/e/' +
    '2PACX-1vQWIsIYz5xz3NNvpet3VCSYBNp_epEm90SXC7oEvETucI9SBia7GbZkyNyRXEoFt02h9nqxPtsKTJm2' +
    '/pub?output=csv&gid=';

const GID_TASKS        = '0';
const GID_TRABAJADORES = '89297275';

// ── HTTP helper (follows redirects, same as proxy.js) ────────────────────────
function fetchText(url, redirects = 0) {
    if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
        }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location)
                return fetchText(res.headers.location, redirects + 1).then(resolve, reject);
            let body = '';
            res.setEncoding('utf8');
            res.on('data', c => { body += c; });
            res.on('end', () => resolve(body));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

// ── CSV parser (same logic as app.js) ────────────────────────────────────────
function parseCSV(text) {
    const rows = []; let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQ) {
            if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') inQ = false;
            else cur += c;
        } else if (c === '"') { inQ = true; }
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (c !== '\r') { cur += c; }
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
}

// ── Date parser DD/MM/YYYY ────────────────────────────────────────────────────
function parseDate(s) {
    if (!s) return null;
    const p = s.toString().trim().split('/');
    if (p.length === 3) {
        const d = new Date(`${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`);
        return isNaN(d) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d) ? null : d;
}

// ── Email sender via Resend ───────────────────────────────────────────────────
async function sendEmail(apiKey, to, icon, title, msg, tasks) {
    const timestamp = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
    const taskRows = Array.isArray(tasks) && tasks.length ? `
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="text-align:left;padding:6px 10px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0">Tarea</th>
            <th style="text-align:left;padding:6px 10px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;white-space:nowrap">Vencimiento</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map((t, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
            <td style="padding:7px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9">${t.text}</td>
            <td style="padding:7px 10px;color:#dc2626;font-family:monospace;border-bottom:1px solid #f1f5f9;white-space:nowrap">${t.deadline}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:#0f172a;padding:20px 24px;display:flex;align-items:center;gap:12px">
      <span style="font-size:24px">${icon}</span>
      <span style="color:#fff;font-weight:700;font-size:16px;letter-spacing:0.05em">ADDITIUM 3D DASHBOARD</span>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px">${title}</h2>
      <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">${msg}</p>
      ${taskRows}
    </div>
    <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <small style="color:#94a3b8;font-size:11px;font-family:monospace">${timestamp}</small>
    </div>
  </div>
</body></html>`;

    const payload = JSON.stringify({
        from: 'Additium Dashboard <notifications@flcr.my.id>',
        to: [to],
        subject: `[Additium] ${title}`,
        html,
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.resend.com',
            path: '/emails',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (res) => {
            let body = '';
            res.on('data', c => { body += c; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch { resolve({ status: res.statusCode, data: body }); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ── Main handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
    // Verify cron secret (Vercel passes it automatically; also allows manual test)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`)
        return res.status(401).json({ error: 'Unauthorized' });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

    const mainEmail = process.env.NOTIFY_EMAIL;

    try {
        // 1. Fetch worker email map from Trabajadores sheet
        const workerCSV = await fetchText(SPREADSHEET_BASE + GID_TRABAJADORES + '&t=' + Date.now());
        const workerRows = parseCSV(workerCSV).slice(1); // skip header
        const workerEmails = {};
        for (const row of workerRows) {
            const name  = (row[0] || '').trim().toUpperCase();
            const email = (row[1] || '').trim();
            if (name && email.includes('@')) workerEmails[name] = email;
        }

        // 2. Fetch tasks
        const tasksCSV = await fetchText(SPREADSHEET_BASE + GID_TASKS + '&t=' + Date.now());
        const taskRows = parseCSV(tasksCSV).slice(1); // skip header

        // Date helpers (Madrid timezone)
        const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
        const todayStr  = nowMadrid.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const tomorrowD = new Date(nowMadrid); tomorrowD.setDate(nowMadrid.getDate() + 1);
        const tomorrowStr = tomorrowD.toLocaleDateString('en-CA');
        const isMonday = nowMadrid.getDay() === 1;

        // 3. Parse tasks, group by worker
        const byWorker = {}; // { WORKER: { today: [], tomorrow: [], all: [] } }
        for (const row of taskRows) {
            const has7   = row.length >= 7;
            const worker = (row[has7 ? 1 : 0] || '').trim().toUpperCase();
            const task   = (row[has7 ? 2 : 1] || '').trim();
            const status = (row[has7 ? 4 : 3] || '').trim().toUpperCase();
            const dayStr = (row[has7 ? 5 : 4] || '').trim();
            const timeStr= (row[has7 ? 6 : 5] || '').trim();
            if (!worker || !task || task === '—') continue;
            const isDone = status.includes('COMPLET') || status.includes('DONE') ||
                           status.includes('TERMINAD') || status.includes('ENVIADO');
            if (!byWorker[worker]) byWorker[worker] = { today: [], tomorrow: [], all: [] };
            if (!isDone) {
                byWorker[worker].all.push({ text: task, deadline: [dayStr, timeStr].filter(Boolean).join(' ') || '—' });
                const dl = parseDate(dayStr);
                if (dl) {
                    const dlStr = dl.toLocaleDateString('en-CA');
                    const entry = { text: task, deadline: [dayStr, timeStr].filter(Boolean).join(' ') };
                    if (dlStr === todayStr)    byWorker[worker].today.push(entry);
                    if (dlStr === tomorrowStr) byWorker[worker].tomorrow.push(entry);
                }
            }
        }

        const results = [];

        // 4. Send per-worker deadline reminders
        for (const [worker, { today: todayTasks, tomorrow: tomorrowTasks }] of Object.entries(byWorker)) {
            const email = workerEmails[worker];
            if (!email) continue;
            if (todayTasks.length) {
                const r = await sendEmail(apiKey, email, '🔴',
                    `[${worker}] Tareas vencen HOY`,
                    `${todayTasks.length} tarea${todayTasks.length > 1 ? 's vencen' : ' vence'} hoy. Por favor revisa y actualiza el estado.`,
                    todayTasks);
                results.push({ worker, type: 'today', email, status: r.status });
            }
            if (tomorrowTasks.length) {
                const r = await sendEmail(apiKey, email, '⚠️',
                    `[${worker}] Tareas vencen MAÑANA`,
                    `${tomorrowTasks.length} tarea${tomorrowTasks.length > 1 ? 's vencen' : ' vence'} mañana. Recuerda completarlas a tiempo.`,
                    tomorrowTasks);
                results.push({ worker, type: 'tomorrow', email, status: r.status });
            }
        }

        // 5. Monday weekly summary → main email
        if (isMonday && mainEmail) {
            const allActive = Object.entries(byWorker).flatMap(([worker, { all }]) =>
                all.map(t => ({ text: `[${worker}] ${t.text}`, deadline: t.deadline }))
            );
            if (allActive.length) {
                const r = await sendEmail(apiKey, mainEmail, '📋',
                    'Resumen Semanal de Tareas',
                    `${allActive.length} tarea${allActive.length > 1 ? 's activas' : ' activa'} esta semana.`,
                    allActive);
                results.push({ type: 'weekly', email: mainEmail, status: r.status });
            }
        }

        console.log('[cron-reminders] done:', JSON.stringify(results));
        return res.status(200).json({ ok: true, sent: results.length, results });

    } catch (err) {
        console.error('[cron-reminders] error:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
