// ===== V5 SPA DASHBOARD CONTROLLER =====
// processTodo uses adaptive per-row column detection:
//   - 7-col rows (have ID): worker=r[1], task=r[2], priority=r[3], status=r[4], day=r[5], time=r[6]
//   - 6-col rows (no ID):   worker=r[0], task=r[1], priority=r[2], status=r[3], day=r[4], time=r[5]

function spaDashboard() {
    return {
        activeScreen: 1,
        rotateCd: 45,
        refreshCd: 30,
        clock: '--:--:--',
        dateStr: '--',
        lastSync: '--:--:--',
        loading: true,
        synced: false,
        toasts: [],
        refreshKey: 0,
        paused: false,
        isFullscreen: false,
        usingFallback: false,
        settingsOpen: false,
        statusBarVisible: true,
        _rotateCustom: false,
        _refreshCustom: false,
        ctxMenu: { show: false, x: 0, y: 0 },

        settings: {
            showCountdown: false,
            rotateInterval: 45,
            refreshInterval: 30,
            autoHideStatusBar: true,
            autoRotate: true,
            clockFormat: '24h',
            lang: 'en',
            darkMode: false,
            browserNotify: false,
            emailNotify: false,
        },

        todo: { employees: [], kpiOpen: 0, kpiUrgent: 0, kpiProg: 0, kpiEmp: 0, prevUrgent: 0 },
        orders: { list: [], valShip: 0, valProd: 0, valPend: 0, prevShip: 0, prevProd: 0 },
        events: { today: [], upcoming: [], prevTodayCount: 0, prevUpcomingCount: 0 },
        machines: { list: [] },
        leads: {
            columns: [
                { key: 'contact',    items: [] },
                { key: 'meeting',    items: [] },
                { key: 'quote',      items: [] },
                { key: 'prototypes', items: [] },
                { key: 'waiting',    items: [] },
            ]
        },

        async init() {
            this.loadSettings();
            this.rotateCd = this.settings.rotateInterval;
            this.refreshCd = this.settings.refreshInterval;
            this.startClock();
            await this.fetchAllData();
            this.loading = false;
            this.startRotation();
            this.startRefreshTimer();
            this.initAutoScroll();
            this.initFullscreenListener();
            this.$watch(() => JSON.stringify(this.settings), () => {
                localStorage.setItem('additium_v5_settings', JSON.stringify(this.settings));
            });
            this.applyDarkMode(this.settings.darkMode);
            this.$watch('settings.darkMode', (val) => this.applyDarkMode(val));
            // Auto-hide status bar: always show on load, then hide after 2 seconds
            setTimeout(() => { this.statusBarVisible = false; }, 2000);
            // Context menu handler
            this.initContextMenu();
        },

        startClock() {
            const tick = () => {
                const n = new Date();
                this.clock = this.settings.clockFormat === '12h'
                    ? n.toLocaleTimeString('en-US', { hour12: true })
                    : n.toLocaleTimeString('en-GB');
                this.dateStr = n.toLocaleDateString('en-GB', {
                    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
                }).toUpperCase();
            };
            tick();
            setInterval(tick, 1000);
        },

        startRotation() {
            setInterval(() => {
                if (!this.paused && this.settings.autoRotate) {
                    this.rotateCd--;
                    if (this.rotateCd <= 0) {
                        this.rotateCd = this.settings.rotateInterval;
                        this.nextScreen();
                    }
                }
            }, 1000);
        },

        startRefreshTimer() {
            setInterval(() => {
                this.refreshCd--;
                if (this.refreshCd <= 0) {
                    this.refreshCd = this.settings.refreshInterval;
                    this.fetchAllData();
                }
            }, 1000);
        },

        initAutoScroll() {
            // Tick counter controls speed per element type (no fractional px issues).
            // emp-tasks:         1px per 4 ticks (200ms) ≈ 5px/s  — very slow, 5s initial delay
            // table-body orders: 1px per 6 ticks (300ms) ≈ 3px/s  — slow, no delay
            // table-body machines: 1px per 6 ticks (300ms) ≈ 3px/s — slow, 5s initial delay
            // event-list:        1px per 3 ticks (150ms) ≈ 6px/s  — slow, 5s initial delay
            // Hover over any scrollable element pauses its scroll.
            const DELAY_MS = 5000;
            let tick = 0;
            setInterval(() => {
                tick++;
                document.querySelectorAll('.emp-tasks, .event-list, .table-body').forEach(el => {
                    if (el.scrollHeight <= el.clientHeight) return;
                    if (el.matches(':hover')) return;

                    const isMachines  = el.classList.contains('table-body') && !!el.closest('.machines');
                    const isEmpTasks  = el.classList.contains('emp-tasks');
                    const isEventList = el.classList.contains('event-list');
                    const needsDelay  = isEmpTasks || isMachines || isEventList;

                    // Speed throttle
                    if (isEmpTasks  && tick % 4 !== 0) return;
                    if (isEventList && tick % 3 !== 0) return;
                    if (el.classList.contains('table-body') && tick % 6 !== 0) return;

                    // 5s hold at top on first appearance and after each reset
                    if (needsDelay) {
                        if (!el.dataset.readyAt) el.dataset.readyAt = Date.now() + DELAY_MS;
                        if (Date.now() < parseInt(el.dataset.readyAt)) return;
                    }

                    el.scrollTop += 1;

                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
                        if (!el.dataset.resetting) {
                            el.dataset.resetting = true;
                            setTimeout(() => {
                                el.scrollTop = 0;
                                delete el.dataset.resetting;
                                if (needsDelay) el.dataset.readyAt = Date.now() + DELAY_MS;
                            }, 3000);
                        }
                    }
                });
            }, 50);
        },

        nextScreen() { this.activeScreen = (this.activeScreen % 5) + 1; },
        prevScreen() { this.activeScreen = this.activeScreen <= 1 ? 5 : this.activeScreen - 1; },
        setScreen(id) { this.activeScreen = id; this.rotateCd = this.settings.rotateInterval; },
        togglePause() { this.paused = !this.paused; if (!this.paused) this.rotateCd = this.settings.rotateInterval; },

        get activeWorker() {
            if (this.activeScreen < 6) return null;
            return this.todo.employees[this.activeScreen - 6] || null;
        },

        workerMeetings(workerName) {
            const name = (workerName || '').toLowerCase();
            const match = e => (e.responsible || '').toLowerCase().includes(name);
            return {
                today: this.events.today.filter(match),
                upcoming: this.events.upcoming.filter(match),
            };
        },

        setRotateInterval(sec) {
            this.settings.rotateInterval = sec;
            this.rotateCd = sec;
        },

        setRefreshInterval(sec) {
            this.settings.refreshInterval = sec;
            this.refreshCd = sec;
        },

        loadSettings() {
            try {
                const saved = JSON.parse(localStorage.getItem('additium_v5_settings') || '{}');
                Object.assign(this.settings, saved);
            } catch (e) { /* ignore corrupt storage */ }
        },

        resetSettings() {
            Object.assign(this.settings, {
                showCountdown: false,
                rotateInterval: 45,
                refreshInterval: 30,
                autoHideStatusBar: true,
                autoRotate: true,
                clockFormat: '24h',
                lang: 'en',
                darkMode: false,
            });
            this.rotateCd = 45;
            this.refreshCd = 30;
            this.statusBarVisible = true;
            this._rotateCustom = false;
            this._refreshCustom = false;
            localStorage.removeItem('additium_v5_settings');
        },

        sbEnter() {
            clearTimeout(this._sbTimer);
            this.statusBarVisible = true;
        },

        sbLeave() {
            if (this.settings.autoHideStatusBar && !this.settingsOpen) {
                this._sbTimer = setTimeout(() => { this.statusBarVisible = false; }, 1500);
            }
        },

        t(key) {
            const lang = this.settings.lang || 'en';
            const tr = TRANSLATIONS[lang] || TRANSLATIONS.en;
            return tr[key] !== undefined ? tr[key] : (TRANSLATIONS.en[key] || key);
        },

        applyDarkMode(dark) {
            document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
        },

        toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => { });
            } else {
                document.exitFullscreen().catch(() => { });
            }
        },

        initFullscreenListener() {
            document.addEventListener('fullscreenchange', () => {
                this.isFullscreen = !!document.fullscreenElement;
            });
        },

        get rotatePct() { return (this.rotateCd / this.settings.rotateInterval) * 100; },
        get syncColor() { return this.refreshCd <= 8 ? 'var(--red)' : this.refreshCd <= 18 ? 'var(--amber)' : 'var(--green)'; },
        pad(n) { return String(n).padStart(2, '0'); },

        toast(icon, title, msg, color) {
            const id = Date.now();
            this.toasts.push({ id, icon, title, msg, color, show: true });
            setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, 5500);
        },

        notify(icon, title, msg, color) {
            this.toast(icon, title, msg, color);
            if (this.settings.browserNotify && typeof Notification !== 'undefined' && Notification.permission === 'granted')
                new Notification(title, { body: msg, icon: '/img/logo_additium.png' });
            if (this.settings.emailNotify)
                this.sendEmailNotify(icon, title, msg);
        },

        async requestBrowserNotify() {
            if (typeof Notification === 'undefined') {
                this.toast('⚠️', this.t('settNotifyDenied'), '', '#d97706');
                return;
            }
            if (Notification.permission === 'granted') { this.settings.browserNotify = true; return; }
            const p = await Notification.requestPermission();
            if (p === 'granted') { this.settings.browserNotify = true; }
            else { this.settings.browserNotify = false; this.toast('⚠️', this.t('settNotifyDenied'), '', '#d97706'); }
        },

        async sendEmailNotify(icon, title, msg) {
            const key = 'additium_email_' + btoa(encodeURIComponent(title)).slice(0, 24);
            const last = parseInt(localStorage.getItem(key) || '0');
            if (Date.now() - last < 5 * 60 * 1000) return;
            localStorage.setItem(key, Date.now());
            try {
                await fetch('/api/notify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ icon, title, msg }),
                });
            } catch (e) { console.warn('[email notify]', e.message); }
        },

        parseCSV(t) {
            const rows = []; let row = [], cur = '', inQ = false;
            for (let i = 0; i < t.length; i++) {
                const ch = t[i];
                if (inQ) {
                    if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; }
                    else if (ch === '"') inQ = false;
                    else cur += ch;
                } else {
                    if (ch === '"') inQ = true;
                    else if (ch === ',') { row.push(cur); cur = ''; }
                    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
                    else if (ch !== '\r') cur += ch;
                }
            }
            if (cur || row.length) { row.push(cur); rows.push(row); }
            return rows;
        },

        parseDate(s) {
            if (!s) return null;
            const p = s.toString().split('/');
            if (p.length === 3) return new Date(`${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`);
            const d = new Date(s);
            return isNaN(d) ? null : d;
        },

        isToday(s) {
            const d = this.parseDate(s); if (!d) return false;
            const n = new Date();
            return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
        },

        async fetchSheet(sheetName) {
            // Layer 1: proxy (fresh data, no CDN cache)
            const proxyUrl = getCsvUrl(sheetName) + '&t=' + Date.now();
            try {
                const res = await fetch(proxyUrl, {
                    cache: 'no-store',
                    headers: { 'Pragma': 'no-cache' },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            } catch (proxyErr) {
                // Layer 2: direct Google Sheets (data mungkin slightly stale dari CDN)
                console.warn(`[proxy] ${proxyErr.message} — falling back to direct fetch`);
                if (!this.usingFallback) {
                    this.usingFallback = true;
                    this.toast('⚠️', this.t('toastFallbackTitle'), this.t('toastFallbackMsg'), '#d97706');
                }
                const fallbackUrl = CONFIG.spreadsheetBase + CONFIG.sheets[sheetName] + '&t=' + Date.now();
                const res = await fetch(fallbackUrl);
                if (!res.ok) throw new Error(`Fallback failed: HTTP ${res.status}`);
                return res.text();
            }
        },

        async fetchAllData() {
            try {
                const [todoRaw, ordersRaw, eventsRaw, machinesRaw] = await Promise.all([
                    this.fetchSheet('tasks'),
                    this.fetchSheet('orders'),
                    this.fetchSheet('events'),
                    this.fetchSheet('machines'),
                ]);
                this.processTodo(this.parseCSV(todoRaw).slice(1));
                this.processOrders(this.parseCSV(ordersRaw).slice(1));
                this.processEvents(this.parseCSV(eventsRaw).slice(1));
                this.processMachines(this.parseCSV(machinesRaw).slice(1));
                this.lastSync = new Date().toLocaleTimeString('en-GB');
                this.refreshKey++;
                this.synced = true;
                setTimeout(() => this.synced = false, 1500);
            } catch (e) {
                console.error('[fetchAllData] Error:', e.message);
                this.toast('⚠️', this.t('toastSyncError'), e.message, '#d97706');
            }
        },

        // ─── Helper: get column value per-row, adapting to 6-col or 7-col format ───
        // 7-col row (has ID in col 0): ID | Worker | Task | Priority | Status | Day | Time
        // 6-col row (no ID col):           Worker | Task | Priority | Status | Day | Time
        getCol(row, colName) {
            const has7 = row.length >= 7;
            const map7 = { worker: 1, task: 2, priority: 3, status: 4, day: 5, time: 6 };
            const map6 = { worker: 0, task: 1, priority: 2, status: 3, day: 4, time: 5 };
            const idx = (has7 ? map7 : map6)[colName];
            return idx !== undefined ? (row[idx] || '').trim() : '';
        },

        // ─── Screen 01: TODO ────────────────────────────────────────────────────────
        processTodo(rows) {
            const DONE = CONFIG.doneStatuses;
            const PC = CONFIG.priorities;
            const PO = { URGENTE: 0, ALTA: 1, IMPORTANTE: 1, NORMAL: 2, BAJA: 3 };

            // Keep rows with a worker name, not done (same as original todo.js)
            const active = rows.filter(r => {
                const w = this.getCol(r, 'worker');
                const s = this.getCol(r, 'status').toUpperCase();
                return w && !DONE.includes(s);
            });

            // Group by worker name
            const byW = {};
            active.forEach(r => {
                const w = this.getCol(r, 'worker').toUpperCase();
                if (!byW[w]) byW[w] = [];
                byW[w].push(r);
            });

            // Sort workers: most urgent first, then alphabetical
            const workers = Object.keys(byW).sort((a, b) => {
                const urg = arr => arr.filter(r => this.getCol(r, 'priority').toUpperCase() === 'URGENTE').length;
                return urg(byW[b]) - urg(byW[a]) || a.localeCompare(b);
            });

            // Build flat task list per worker, sorted by priority
            this.todo.employees = workers.map(w => {
                const tasks = byW[w]
                    .sort((a, b) => {
                        const pa = PO[this.getCol(a, 'priority').toUpperCase()] ?? 2;
                        const pb = PO[this.getCol(b, 'priority').toUpperCase()] ?? 2;
                        return pa - pb;
                    })
                    .map(r => {
                        const priority = this.getCol(r, 'priority').toUpperCase() || 'NORMAL';
                        const text = this.getCol(r, 'task') || '—';
                        const status = this.getCol(r, 'status').toUpperCase() || 'PENDING';
                        const deadlineDay = this.getCol(r, 'day');
                        const deadlineTime = this.getCol(r, 'time');
                        return {
                            priority,
                            text,
                            status,
                            color: PC[priority] || '#888',
                            isUrgent: priority === 'URGENTE',
                            deadlineDay,
                            deadlineTime
                        };
                    })
                    // Drop the empty-task rows (the trailing empty Jason row)
                    .filter(t => t.text && t.text !== '—' || t.deadlineDay || t.deadlineTime);

                return { name: w, tasks };
            }).filter(emp => emp.tasks.length > 0);

            const urgCount = active.filter(r => this.getCol(r, 'priority').toUpperCase() === 'URGENTE').length;
            this.todo.kpiOpen = active.length;
            this.todo.kpiUrgent = urgCount;
            this.todo.kpiProg = active.filter(r => {
                const s = this.getCol(r, 'status').toUpperCase();
                return s.includes('CURSO') || s.includes('PROGRESS') || s.includes('HACIENDO');
            }).length;
            this.todo.kpiEmp = workers.length;

            if (this.refreshKey > 0 && urgCount > this.todo.prevUrgent)
                this.notify('🚨', this.t('toastUrgentTitle'), (urgCount > 1 ? this.t('toastUrgentMsgPlural') : this.t('toastUrgentMsg')).replace('{n}', urgCount), '#dc2626');
            this.todo.prevUrgent = urgCount;
        },

        // ─── Screen 02: ORDERS ──────────────────────────────────────────────────────
        processOrders(rows) {
            const COLS = { id: 0, client: 1, date: 2, importance: 3, status: 4 };
            const CAT_ORDER = { shipping: 0, production: 1, pending: 2, done: 3 };
            const valid = rows.filter(r => (r[COLS.id] || '').trim() !== '');
            let shipCount = 0, prodCount = 0, pendCount = 0;

            const items = valid.map(r => {
                const rawStatus = (r[COLS.status] || '—').trim();
                const stUpper = rawStatus.toUpperCase();
                let cat = 'pending';
                if (stUpper.includes('ENVIAD') || CONFIG.doneStatuses.includes(stUpper)) cat = 'done';
                else if (stUpper.includes('LISTO') || stUpper.includes('SHIP') || stUpper.includes('DESPACHO') || this.isToday(r[COLS.date])) cat = 'shipping';
                else if (stUpper.includes('FABRICAN') || stUpper.includes('FABRICÁN') || stUpper.includes('CURSO') || stUpper.includes('PRODUC')) cat = 'production';
                else if (stUpper.includes('POR FAB') || stUpper.includes('PEND')) cat = 'pending';
                if (cat === 'shipping') shipCount++; else if (cat === 'production') prodCount++; else if (cat === 'pending') pendCount++;
                const d = this.parseDate(r[COLS.date]);
                const dl = d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : (r[COLS.date] || '—');
                const chips = {
                    shipping: { cls: 'chip-ship' },
                    production: { cls: 'chip-prod' },
                    pending: { cls: 'chip-pend' },
                    done: { cls: 'chip-done' }
                };
                const rawImp = (r[COLS.importance] || '—').trim();
                const impUpper = rawImp.toUpperCase();
                let impPillClass = '';
                if (impUpper.includes('XIM') || impUpper.includes('XÍM') || impUpper.includes('MAX')) impPillClass = 'pill-maxima';
                else if (impUpper.includes('ALTA')) impPillClass = 'pill-alta';
                else if (impUpper.includes('NORMAL')) impPillClass = 'pill-normal';
                else if (impUpper.includes('BAJA')) impPillClass = 'pill-baja';

                return {
                    id: r[COLS.id] || '—',
                    client: r[COLS.client] || '—',
                    date: dl,
                    imp: impUpper !== '—' ? rawImp : '—',
                    impClass: impPillClass,
                    cat,
                    chipClass: chips[cat].cls,
                    chipLabel: rawStatus
                };
            });

            items.sort((a, b) => (CAT_ORDER[a.cat] ?? 3) - (CAT_ORDER[b.cat] ?? 3));
            this.orders.list = items;
            this.orders.valShip = shipCount;
            this.orders.valProd = prodCount;
            this.orders.valPend = pendCount;
            if (this.refreshKey > 0 && shipCount > this.orders.prevShip)
                this.notify('🚚', this.t('toastShipTitle'), (shipCount > 1 ? this.t('toastShipMsgPlural') : this.t('toastShipMsg')).replace('{n}', shipCount), '#dc2626');
            this.orders.prevShip = shipCount;
            if (this.refreshKey > 0 && prodCount > this.orders.prevProd)
                this.notify('🏭', this.t('toastProdTitle'), (prodCount > 1 ? this.t('toastProdMsgPlural') : this.t('toastProdMsg')).replace('{n}', prodCount), '#2563eb');
            this.orders.prevProd = prodCount;
        },

        // ─── Screen 03: EVENTS ──────────────────────────────────────────────────────
        processEvents(rows) {
            const COLS = { title: 0, date: 1, place: 2, time: 3, responsible: 4 };

            const isFuture = s => {
                const d = this.parseDate(s); if (!d) return false;
                const n = new Date(); n.setHours(0, 0, 0, 0);
                const dc = new Date(d); dc.setHours(0, 0, 0, 0);
                return dc > n;
            };
            const daysUntil = s => {
                const d = this.parseDate(s); if (!d) return null;
                const n = new Date(); n.setHours(0, 0, 0, 0);
                const dc = new Date(d); dc.setHours(0, 0, 0, 0);
                return Math.round((dc - n) / 86400000);
            };

            const valid = rows.filter(r => (r[COLS.title] || '').trim());
            const today = [], upcoming = [];

            valid.forEach(r => {
                const entry = {
                    title: r[COLS.title] || '',
                    time: r[COLS.time] || '',
                    place: r[COLS.place] || '',
                    responsible: r[COLS.responsible] || ''
                };
                if (this.isToday(r[COLS.date])) {
                    today.push(entry);
                } else if (isFuture(r[COLS.date])) {
                    const d = this.parseDate(r[COLS.date]);
                    const days = daysUntil(r[COLS.date]);
                    const dl = d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : (r[COLS.date] || '—');
                    const dn = d ? d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase() : '';
                    upcoming.push({
                        ...entry,
                        dateLabel: dl,
                        dayName: dn,
                        days: days,
                        badgeClass: days === 1 ? 'tomorrow' : days <= 3 ? 'soon' : 'normal',
                        sortKey: d ? d.getTime() : 999999999
                    });
                }
            });

            upcoming.sort((a, b) => a.sortKey - b.sortKey);
            this.events.today = today;
            this.events.upcoming = upcoming;
            if (this.refreshKey > 0 && today.length > this.events.prevTodayCount)
                this.notify('📅', this.t('toastEventTitle'), today[today.length - 1].title, '#d97706');
            this.events.prevTodayCount = today.length;
            if (this.refreshKey > 0 && upcoming.length > this.events.prevUpcomingCount)
                this.notify('🗓️', this.t('toastUpcomingTitle'), upcoming[upcoming.length - 1].title, '#7c3aed');
            this.events.prevUpcomingCount = upcoming.length;
        },

        // ─── Screen 04: MACHINES ────────────────────────────────────────────────────
        processMachines(rows) {
            const techClass = t => {
                const u = (t || '').toUpperCase();
                if (u.includes('MJF')) return 'tech-mjf';
                if (u.includes('SLS')) return 'tech-sls';
                if (u.includes('FDM')) return 'tech-fdm';
                return 'tech-other';
            };
            this.machines.list = rows
                .filter(r => (r[0] || '').trim() !== '')
                .map(r => ({
                    id:          (r[0] || '').trim(),
                    tech:        (r[1] || '').trim(),
                    techClass:   techClass(r[1]),
                    machine:     (r[2] || '').trim(),
                    brand:       (r[3] || '').trim(),
                    currentJob:  (r[4] || '—').trim(),
                    currentEnd:  (r[5] || '').trim(),
                    nextJob:     (r[6] || '—').trim(),
                    nextEnd:     (r[7] || '').trim(),
                    lastProblem: (r[8] || '—').trim(),
                }));
        },

        // ─── CONTEXT MENU ──────────────────────────────────────────────────────
        initContextMenu() {
            // Disable default context menu and show custom menu
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY);
            });

            // Hide context menu on click elsewhere
            document.addEventListener('click', (e) => {
                // Don't close if clicking inside context menu
                if (!e.target.closest('.context-menu')) {
                    this.ctxMenu.show = false;
                }
            });

            // Hide context menu on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.ctxMenu.show = false;
                }
            });

            // Hide context menu on wheel scroll (user-initiated only)
            let wheelTimeout;
            document.addEventListener('wheel', () => {
                this.ctxMenu.show = false;
                clearTimeout(wheelTimeout);
            }, { passive: true });
        },

        showContextMenu(x, y) {
            const menuWidth = 280;
            const menuHeight = 320;
            const padding = 10;

            // Adjust position to keep menu within viewport
            let newX = x;
            let newY = y;

            if (x + menuWidth + padding > window.innerWidth) {
                newX = window.innerWidth - menuWidth - padding;
            }

            if (y + menuHeight + padding > window.innerHeight) {
                newY = window.innerHeight - menuHeight - padding;
            }

            this.ctxMenu.x = newX;
            this.ctxMenu.y = newY;
            this.ctxMenu.show = true;
        },

        reloadPage() {
            // Hard refresh: clear cache and reload
            window.location.reload(true);
        },
    };
}