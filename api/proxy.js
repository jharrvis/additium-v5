/**
 * ADDITIUM 3D – Google Sheets CSV Proxy (Vercel Serverless Function)
 * ------------------------------------------------------------------
 * Deployed automatically by Vercel from the /api directory.
 * Fetches spreadsheet data server-side so the browser is never blocked
 * by Google's CDN cache.
 *
 * Endpoint: /api/proxy?sheet=tasks | orders | events
 */

const https = require('https');

// Sheet name → GID mapping (keep in sync with config.js)
const SHEETS = {
    tasks:    '0',
    orders:   '859622579',
    events:   '2006704627',
    machines: '348601046',
};

const SPREADSHEET_BASE =
    'https://docs.google.com/spreadsheets/d/e/' +
    '2PACX-1vQWIsIYz5xz3NNvpet3VCSYBNp_epEm90SXC7oEvETucI9SBia7GbZkyNyRXEoFt02h9nqxPtsKTJm2' +
    '/pub?output=csv&gid=';

/**
 * Fetch a URL with proper no-cache headers, following redirects.
 * @param {string} url
 * @returns {Promise<string>}
 */
function fetchText(url, redirects = 0) {
    if (redirects > 5) return Promise.reject(new Error('Too many redirects'));

    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'Cache-Control': 'no-cache, no-store',
                'Pragma': 'no-cache',
                'User-Agent': 'AdditiumDashboard/5.0',
            },
        }, (res) => {
            // Follow redirects
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                return fetchText(res.headers.location, redirects + 1).then(resolve, reject);
            }

            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => resolve(body));
            res.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(12000, () => {
            req.destroy();
            reject(new Error('Request timeout after 12s'));
        });
    });
}

module.exports = async function handler(req, res) {
    const sheet = (req.query && req.query.sheet) ? String(req.query.sheet) : '';
    const gid   = SHEETS[sheet];

    if (!gid) {
        res.status(400).json({ error: 'Invalid sheet name. Use: tasks | orders | events' });
        return;
    }

    const url = SPREADSHEET_BASE + gid + '&t=' + Date.now();

    try {
        const data = await fetchText(url);

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.status(200).send(data);
    } catch (err) {
        console.error('[proxy] Fetch error:', err.message);
        res.status(502).json({ error: 'Failed to fetch from Google Sheets', detail: err.message });
    }
};
