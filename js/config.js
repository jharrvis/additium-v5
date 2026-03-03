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

// ── i18n Translations ─────────────────────────────────────────────────────
const TRANSLATIONS = {
    en: {
        // Status bar
        live: 'ADDITIUM 3D SPA · REALTIME · LAST SYNC',
        syncedLabel: 'SYNCED ✓',
        syncIn: 'SYNC IN',
        rotate: 'ROTATE',
        nextIn: '· NEXT IN',
        refreshIn: 'REFRESH IN',
        // Screen selector
        scr1: 'SCR 01 · TODO',
        scr2: 'SCR 02 · ORDERS',
        scr3: 'SCR 03 · EVENTS',
        // Screen titles + badges
        screen1: 'TO DO LIST',      badge1: 'SCREEN 01',
        screen2: 'ORDERS DASHBOARD', badge2: 'SCREEN 02',
        screen3: 'SCHEDULED EVENTS', badge3: 'SCREEN 03',
        // Screen 1 — TODO
        loading: 'FETCHING DATA…',
        noActiveTasks: 'No active tasks',
        kpiOpenTasks: 'Open Tasks',
        kpiAcross: 'ACROSS',
        kpiEmployee: 'EMPLOYEE',
        kpiEmployees: 'EMPLOYEES',
        kpiUrgent: 'Urgent (P1)',
        kpiRequiresAttn: 'REQUIRES ATTENTION',
        kpiInProgress: 'In Progress',
        kpiCurrentlyActive: 'CURRENTLY ACTIVE',
        kpiLegend: 'Priority Legend',
        // Screen 2 — ORDERS
        ordShipping: 'SHIPPING TODAY',
        ordProduction: 'IN PRODUCTION',
        ordPending: 'PENDING PROD.',
        ordNoShip: 'No orders to ship',
        ordNoProd: 'No orders in production',
        ordNoPend: 'No orders pending',
        ordNoOrders: 'No orders',
        ordNoFound: 'No orders found',
        thOrderId: 'ORDER ID',
        thClient: 'CLIENT',
        thShipDate: 'SHIP DATE',
        thPriority: 'PRIORITY',
        thStatus: 'STATUS',
        // Screen 3 — EVENTS
        evToday: 'TODAY',
        evEvent: 'EVENT',
        evEvents: 'EVENTS',
        evUpcoming: 'UPCOMING',
        evScheduled: 'SCHEDULED',
        evNoToday: 'No events today',
        evNoUpcoming: 'No upcoming events',
        evTomorrow: 'TOMORROW',
        evInDays: 'IN {n} DAYS',
        // Toasts
        toastFallbackTitle: 'Fallback Mode',
        toastFallbackMsg: 'Proxy unavailable — fetching directly from Google Sheets (data may be slightly stale)',
        toastSyncError: 'Sync Error',
        toastUrgentTitle: 'Urgent Task Alert',
        toastUrgentMsg: '{n} urgent task requires attention',
        toastUrgentMsgPlural: '{n} urgent tasks require attention',
        toastShipTitle: 'Shipping Alert',
        toastShipMsg: '{n} order shipping today',
        toastShipMsgPlural: '{n} orders shipping today',
        toastEventTitle: 'New Event Today',
        // Settings
        settTitle: 'Settings',
        settSubtitle: 'Auto-saved in this browser',
        settReset: '↺ Reset to Defaults',
        settLangLabel: 'Language',
        settLangDesc: 'Interface language',
        secDisplay: 'Display',
        setCountdownLabel: 'Countdown Timers',
        setCountdownDesc: 'Show "NEXT IN" and "REFRESH IN" in status bar',
        setClockLabel: 'Clock Format',
        setClockDesc: 'Header clock display',
        setThemeLabel: 'Theme',
        setThemeDesc: 'Light or dark interface',
        setThemeLight: 'Light',
        setThemeDark: 'Dark',
        secRotation: 'Auto Rotation',
        setAutoRotateLabel: 'Auto Rotate',
        setAutoRotateDesc: 'Automatically switch screens',
        setRotateIntervalLabel: 'Rotation Interval',
        setCurrent: 'Current',
        secRefresh: 'Data Refresh',
        setRefreshIntervalLabel: 'Refresh Interval',
        secStatusBar: 'Status Bar',
        setAutoHideLabel: 'Auto-Hide Status Bar',
        setAutoHideDesc: 'Hides automatically · hover bottom of screen to reveal',
        settCustom: 'Custom',
        settSeconds: 's',
    },
    es: {
        // Status bar
        live: 'ADDITIUM 3D SPA · TIEMPO REAL · ÚLTIMA SYNC',
        syncedLabel: 'SINCRONIZADO ✓',
        syncIn: 'SYNC EN',
        rotate: 'ROTAR',
        nextIn: '· PRÓXIMO EN',
        refreshIn: 'ACTUALIZAR EN',
        // Screen selector
        scr1: 'PNT 01 · TAREAS',
        scr2: 'PNT 02 · PEDIDOS',
        scr3: 'PNT 03 · EVENTOS',
        // Screen titles + badges
        screen1: 'LISTA DE TAREAS',     badge1: 'PANTALLA 01',
        screen2: 'PEDIDOS',              badge2: 'PANTALLA 02',
        screen3: 'EVENTOS PROGRAMADOS',  badge3: 'PANTALLA 03',
        // Screen 1 — TODO
        loading: 'CARGANDO DATOS…',
        noActiveTasks: 'Sin tareas activas',
        kpiOpenTasks: 'Tareas Abiertas',
        kpiAcross: 'DE',
        kpiEmployee: 'EMPLEADO',
        kpiEmployees: 'EMPLEADOS',
        kpiUrgent: 'Urgentes (P1)',
        kpiRequiresAttn: 'REQUIEREN ATENCIÓN',
        kpiInProgress: 'En Curso',
        kpiCurrentlyActive: 'ACTUALMENTE ACTIVAS',
        kpiLegend: 'Leyenda de Prioridad',
        // Screen 2 — ORDERS
        ordShipping: 'ENVÍO HOY',
        ordProduction: 'EN PRODUCCIÓN',
        ordPending: 'PEND. PRODUCCIÓN',
        ordNoShip: 'Sin pedidos para envío',
        ordNoProd: 'Sin pedidos en producción',
        ordNoPend: 'Sin pedidos pendientes',
        ordNoOrders: 'Sin pedidos',
        ordNoFound: 'Sin pedidos encontrados',
        thOrderId: 'PEDIDO',
        thClient: 'CLIENTE',
        thShipDate: 'FECHA ENVÍO',
        thPriority: 'PRIORIDAD',
        thStatus: 'ESTADO',
        // Screen 3 — EVENTS
        evToday: 'HOY',
        evEvent: 'EVENTO',
        evEvents: 'EVENTOS',
        evUpcoming: 'PRÓXIMOS',
        evScheduled: 'PROGRAMADOS',
        evNoToday: 'Sin eventos hoy',
        evNoUpcoming: 'Sin eventos próximos',
        evTomorrow: 'MAÑANA',
        evInDays: 'EN {n} DIAS',
        // Toasts
        toastFallbackTitle: 'Modo Alternativo',
        toastFallbackMsg: 'Proxy no disponible — obteniendo datos directamente de Google Sheets (pueden estar levemente desactualizados)',
        toastSyncError: 'Error de Sincronización',
        toastUrgentTitle: 'Alerta de Tarea Urgente',
        toastUrgentMsg: '{n} tarea urgente requiere atención',
        toastUrgentMsgPlural: '{n} tareas urgentes requieren atención',
        toastShipTitle: 'Alerta de Envío',
        toastShipMsg: '{n} pedido listo para envío hoy',
        toastShipMsgPlural: '{n} pedidos listos para envío hoy',
        toastEventTitle: 'Nuevo Evento Hoy',
        // Settings
        settTitle: 'Configuración',
        settSubtitle: 'Guardado automáticamente en este navegador',
        settReset: '↺ Restablecer valores',
        settLangLabel: 'Idioma',
        settLangDesc: 'Idioma de la interfaz',
        secDisplay: 'Pantalla',
        setCountdownLabel: 'Temporizadores',
        setCountdownDesc: 'Mostrar "PRÓXIMO EN" y "ACTUALIZAR EN" en la barra',
        setClockLabel: 'Formato de Hora',
        setClockDesc: 'Reloj en el encabezado',
        setThemeLabel: 'Tema',
        setThemeDesc: 'Interfaz clara u oscura',
        setThemeLight: 'Claro',
        setThemeDark: 'Oscuro',
        secRotation: 'Rotación Automática',
        setAutoRotateLabel: 'Auto Rotación',
        setAutoRotateDesc: 'Cambiar pantallas automáticamente',
        setRotateIntervalLabel: 'Intervalo de Rotación',
        setCurrent: 'Actual',
        secRefresh: 'Actualización de Datos',
        setRefreshIntervalLabel: 'Intervalo de Actualización',
        secStatusBar: 'Barra de Estado',
        setAutoHideLabel: 'Ocultar Barra Automáticamente',
        setAutoHideDesc: 'Se oculta sola · hover en la parte inferior para mostrar',
        settCustom: 'Custom',
        settSeconds: 's',
    },
};

// Helper: build proxy URL for a given sheet name
function getCsvUrl(sheetName) {
    return CONFIG.proxyBase + '?sheet=' + sheetName;
}
