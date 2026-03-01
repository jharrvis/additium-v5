// ===== V5 SPA DASHBOARD CONFIGURATION =====

const CONFIG = {
    // ── Proxy endpoint (server-side fetch bypasses Google CDN cache) ──────────
    // Local (Laragon/PHP): proxy.php  |  Production (Vercel): /api/proxy
    proxyBase: (['localhost', '127.0.0.1'].includes(window.location.hostname))
        ? './proxy.php'
        : '/api/proxy',

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
