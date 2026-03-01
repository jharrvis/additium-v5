// ===== V5 SPA DASHBOARD CONFIGURATION =====

const CONFIG = {
    // ── Proxy endpoint ────────────────────────────────────────────────────────
    // Relative URL — browser resolves it from the current page location.
    // Works in all environments without any environment detection:
    //
    //   Laragon  http://contest.test/v5/       + api/proxy → /v5/api/proxy
    //              → served by api/proxy.php via api/.htaccess (Apache rewrite)
    //
    //   Vercel   https://your-app.vercel.app/  + api/proxy → /api/proxy
    //              → served by api/proxy.js (Node.js serverless function)
    //
    proxyBase: 'api/proxy',

    // ── Fallback: direct Google Sheets ────────────────────────────────────────
    // Used automatically if the proxy is unavailable.
    // Data may be slightly stale (Google CDN cache, up to ~1 min).
    spreadsheetBase: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWIsIYz5xz3NNvpet3VCSYBNp_epEm90SXC7oEvETucI9SBia7GbZkyNyRXEoFt02h9nqxPtsKTJm2/pub?output=csv',
    sheets: {
        tasks:  '&gid=0',
        orders: '&gid=859622579',
        events: '&gid=2006704627',
    },

    // Auto-rotation interval in seconds
    rotateInterval: 45,

    // Data refresh interval in seconds
    refreshInterval: 30,

    // Screens order
    screens: [
        { id: 1, title: 'TO DO LIST',        badge: 'SCREEN 01' },
        { id: 2, title: 'ORDERS DASHBOARD',  badge: 'SCREEN 02' },
        { id: 3, title: 'SCHEDULED EVENTS',  badge: 'SCREEN 03' },
    ],

    // Priority colors (light theme)
    priorities: {
        URGENTE:    '#dc2626',
        ALTA:       '#d97706',
        IMPORTANTE: '#d97706',
        NORMAL:     '#2563eb',
        BAJA:       '#059669',
    },

    // Done status values (case-insensitive)
    doneStatuses: ['HECHA', 'DONE', 'COMPLETED', 'COMPLETADA'],
};

// Helper: build proxy URL for a given sheet name
function getCsvUrl(sheetName) {
    return CONFIG.proxyBase + '?sheet=' + sheetName;
}
