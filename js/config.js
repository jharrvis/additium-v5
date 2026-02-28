// ===== V5 SPA DASHBOARD CONFIGURATION =====

const CONFIG = {
    // Google Sheets CSV URL (base)
    spreadsheetBase: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWIsIYz5xz3NNvpet3VCSYBNp_epEm90SXC7oEvETucI9SBia7GbZkyNyRXEoFt02h9nqxPtsKTJm2/pub?output=csv',

    // Sheet GIDs
    sheets: {
        tasks: '&gid=0',        // To-Do Dashboard
        orders: '&gid=859622579', // Orders Dashboard
        events: '&gid=2006704627' // Events Dashboard
    },

    // Auto-rotation interval in seconds (45 seconds)
    rotateInterval: 45,

    // Data refresh interval in seconds (30 seconds)
    refreshInterval: 30,

    // Screens order
    screens: [
        { id: 1, title: 'TO DO LIST', badge: 'SCREEN 01' },
        { id: 2, title: 'ORDERS DASHBOARD', badge: 'SCREEN 02' },
        { id: 3, title: 'SCHEDULED EVENTS', badge: 'SCREEN 03' }
    ],

    // Priority colors (light theme)
    priorities: {
        URGENTE: '#dc2626',
        ALTA: '#d97706',
        NORMAL: '#2563eb',
        BAJA: '#059669'
    },

    // Done status values (case-insensitive)
    doneStatuses: ['HECHA', 'DONE', 'COMPLETED', 'COMPLETADA']
};

// Helper: Get full CSV URL for a sheet
function getCsvUrl(sheetName) {
    return CONFIG.spreadsheetBase + CONFIG.sheets[sheetName];
}
