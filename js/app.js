// ===== V5 SPA DASHBOARD CONTROLLER =====

function spaDashboard() {
    return {
        // --- SPA State ---
        activeScreen: 1,
        rotateCd: CONFIG.rotateInterval,
        refreshCd: CONFIG.refreshInterval,
        clock: '--:--:--',
        dateStr: '--',
        lastSync: '--:--:--',
        loading: true,
        synced: false,
        toasts: [],
        refreshKey: 0,
        paused: false,

        // --- Data Repositories ---
        todo: { employees: [], kpiOpen: 0, kpiUrgent: 0, kpiProg: 0, kpiEmp: 0, prevUrgent: 0 },
        orders: { list: [], valShip: 0, valProd: 0, valPend: 0, prevShip: 0 },
        events: { today: [], upcoming: [], prevTodayCount: 0 },

        // --- Initialization ---
        async init() {
            this.startClock();
            await this.fetchAllData();
            this.loading = false;
            this.startRotation();
            this.startRefreshTimer();
            this.initAutoScroll();
        },

        // --- Timers ---
        startClock() {
            const tick = () => {
                const n = new Date();
                this.clock = n.toLocaleTimeString('en-GB');
                this.dateStr = n.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
            };
            tick();
            setInterval(tick, 1000);
        },

        startRotation() {
            setInterval(() => {
                if (!this.paused) {
                    this.rotateCd--;
                    if (this.rotateCd <= 0) {
                        this.rotateCd = CONFIG.rotateInterval;
                        this.nextScreen();
                    }
                }
            }, 1000);
        },

        startRefreshTimer() {
            setInterval(() => {
                this.refreshCd--;
                if (this.refreshCd <= 0) {
                    this.refreshCd = CONFIG.refreshInterval;
                    this.fetchAllData();
                }
            }, 1000);
        },

        // Global Auto-Scroll Logic
        initAutoScroll() {
            setInterval(() => {
                // Target all overflow-y containers
                const containers = document.querySelectorAll('.emp-tasks, .event-list, .table-body');
                containers.forEach(el => {
                    if (el.scrollHeight > el.clientHeight) {
                        // Slow, smooth scroll
                        el.scrollTop += 0.8;

                        // Reset to top when reaching bottom
                        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
                            // Pause briefly at the bottom before resetting
                            if (!el.dataset.resetting) {
                                el.dataset.resetting = true;
                                setTimeout(() => {
                                    el.scrollTop = 0;
                                    delete el.dataset.resetting;
                                }, 3000);
                            }
                        }
                    }
                });
            }, 50); // Frame rate for scrolling
        },

        nextScreen() {
            this.activeScreen = (this.activeScreen % CONFIG.screens.length) + 1;
        },

        prevScreen() {
            this.activeScreen = this.activeScreen <= 1 ? CONFIG.screens.length : this.activeScreen - 1;
        },

        setScreen(id) {
            this.activeScreen = id;
            this.rotateCd = CONFIG.rotateInterval; // Reset timer on manual switch
        },

        togglePause() {
            this.paused = !this.paused;
            if (!this.paused) {
                this.rotateCd = CONFIG.rotateInterval; // Reset timer when unpausing
            }
        },

        // --- Global Helpers ---
        get rotatePct() { return (this.rotateCd / CONFIG.rotateInterval) * 100 },
        get refreshPct() { return (this.refreshCd / CONFIG.refreshInterval) * 100 },
        get syncColor() { return this.refreshCd <= 8 ? 'var(--red)' : this.refreshCd <= 18 ? 'var(--amber)' : 'var(--green)' },

        pad(n) { return String(n).padStart(2, '0') },

        toast(icon, title, msg, color) {
            const id = Date.now();
            this.toasts.push({ id, icon, title, msg, color, show: true });
            setTimeout(() => {
                this.toasts = this.toasts.filter(t => t.id !== id);
            }, 5500);
        },

        parseCSV(t) {
            const rows = []; let row = [], cur = '', inQ = false;
            for (let i = 0; i < t.length; i++) {
                const ch = t[i];
                if (inQ) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
                else {
                    if (ch === '"') inQ = true; else if (ch === ',') { row.push(cur); cur = ''; }
                    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch;
                }
            } if (cur || row.length) { row.push(cur); rows.push(row); } return rows;
        },

        parseDate(s) {
            if (!s) return null;
            const p = s.toString().split('/');
            if (p.length === 3) return new Date(`${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`);
            const d = new Date(s);
            return isNaN(d) ? null : d;
        },

        isToday(s) {
            const d = this.parseDate(s);
            if (!d) return false;
            const n = new Date();
            return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
        },

        // --- Data Fetching & Processing ---
        async fetchAllData() {
            const ts = Date.now();
            try {
                const [todoRaw, ordersRaw, eventsRaw] = await Promise.all([
                    fetch(getCsvUrl('tasks') + '&t=' + ts).then(r => r.text()),
                    fetch(getCsvUrl('orders') + '&t=' + ts).then(r => r.text()),
                    fetch(getCsvUrl('events') + '&t=' + ts).then(r => r.text())
                ]);

                this.processTodo(this.parseCSV(todoRaw).slice(1));
                this.processOrders(this.parseCSV(ordersRaw).slice(1));
                this.processEvents(this.parseCSV(eventsRaw).slice(1));

                this.lastSync = new Date().toLocaleTimeString('en-GB');
                this.refreshKey++;
                this.synced = true;
                setTimeout(() => this.synced = false, 1500);

            } catch (e) {
                console.error("Data Fetch Error:", e);
            }
        },

        // --- Screen 01: TODO Logic ---
        processTodo(rows) {
            const COLS = { worker: 1, task: 2, priority: 3, status: 4 };
            const DONE = CONFIG.doneStatuses;
            const PC = CONFIG.priorities;
            const PO = { URGENTE: 0, ALTA: 1, NORMAL: 2, BAJA: 3 };

            const active = rows.filter(r => {
                const hasId = r.length === 7 && r[0].trim() !== '';
                const offset = hasId ? 0 : -1;
                const w = (r[COLS.worker + offset] || '').trim();
                const s = (r[COLS.status + offset] || '').toUpperCase().trim();
                return w && !DONE.includes(s);
            });

            const byW = {};
            active.forEach(r => {
                const hasId = r.length === 7 && r[0].trim() !== '';
                const offset = hasId ? 0 : -1;
                const w = (r[COLS.worker + offset] || '').trim().toUpperCase();
                if (!byW[w]) byW[w] = [];
                byW[w].push(r);
            });

            const workers = Object.keys(byW).sort((a, b) => {
                const getUrgCount = (arr) => arr.filter(r => {
                    const hasId = r.length === 7 && r[0].trim() !== '';
                    return (r[COLS.priority + (hasId ? 0 : -1)] || '').toUpperCase().trim() === 'URGENTE';
                }).length;
                return getUrgCount(byW[b]) - getUrgCount(byW[a]) || a.localeCompare(b);
            });

            this.todo.employees = workers.map(w => {
                const tasks = byW[w].sort((a, b) => {
                    const pa = b[COLS.priority] ? PO[(a[COLS.priority] || 'NORMAL').toUpperCase().trim()] ?? 2 : PO[(a[COLS.priority - 1] || 'NORMAL').toUpperCase().trim()] ?? 2;
                    const pb = b[COLS.priority] ? PO[(b[COLS.priority] || 'NORMAL').toUpperCase().trim()] ?? 2 : PO[(b[COLS.priority - 1] || 'NORMAL').toUpperCase().trim()] ?? 2;
                    return pa - pb;
                }).map(r => {
                    // Check if ID exists to determine offset
                    const hasId = r.length === 7 && r[0].trim() !== '';
                    const offset = hasId ? 0 : -1;

                    const priority = (r[COLS.priority + offset] || 'NORMAL').toUpperCase().trim();
                    const text = (r[COLS.task + offset] || '—').trim();
                    const status = (r[COLS.status + offset] || 'PENDING').toUpperCase().trim();
                    const deadlineDay = r[5 + offset] || '';
                    const deadlineTime = r[6 + offset] || '';

                    return {
                        priority,
                        text,
                        status,
                        color: PC[priority] || '#888',
                        isUrgent: priority === 'URGENTE',
                        deadlineDay,
                        deadlineTime,
                    };
                });

                return {
                    name: w,
                    urgent: tasks.filter(t => t.isUrgent),
                    others: tasks.filter(t => !t.isUrgent)
                };
            });

            const urgCount = active.filter(r => {
                const hasId = r.length === 7 && r[0].trim() !== '';
                return (r[COLS.priority + (hasId ? 0 : -1)] || '').toUpperCase().trim() === 'URGENTE';
            }).length;
            this.todo.kpiOpen = active.length;
            this.todo.kpiUrgent = urgCount;
            this.todo.kpiProg = active.filter(r => {
                const hasId = r.length === 7 && r[0].trim() !== '';
                const s = (r[COLS.status + (hasId ? 0 : -1)] || '').toUpperCase().trim();
                return s.includes('CURSO') || s.includes('PROGRESS') || s.includes('HACIENDO');
            }).length;
            this.todo.kpiEmp = workers.length;

            if (this.refreshKey > 0 && urgCount > this.todo.prevUrgent) {
                this.toast('🚨', 'Urgent Task Alert', `${urgCount} urgent task${urgCount > 1 ? 's' : ''} require attention`, '#dc2626');
            }
            this.todo.prevUrgent = urgCount;
        },

        // --- Screen 02: ORDERS Logic ---
        processOrders(rows) {
            const COLS = { id: 0, client: 1, tarea: 2, importance: 3, status: 4, date: 5 };
            const CAT_ORDER = { shipping: 0, production: 1, pending: 2, done: 3 };

            const valid = rows.filter(r => (r[COLS.id] || '').trim());
            let shipCount = 0, prodCount = 0, pendCount = 0;

            const items = valid.map(r => {
                const st = (r[COLS.status] || '').toUpperCase().trim();
                let cat = 'pending';

                if (st.includes('SHIP') || st.includes('ENVIO') || st.includes('DESPACHO') || this.isToday(r[COLS.date])) cat = 'shipping';
                else if (st.includes('FABRICANDO') || st.includes('CURSO') || st.includes('PRODUC') || st.includes('MAKING')) cat = 'production';
                else if (CONFIG.doneStatuses.includes(st)) cat = 'done';

                if (cat === 'shipping') shipCount++;
                else if (cat === 'production') prodCount++;
                else if (cat === 'pending') pendCount++;

                const d = this.parseDate(r[COLS.date]);
                const dl = d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : (r[COLS.date] || '—');

                const chips = {
                    shipping: { cls: 'chip-ship', lbl: 'SHIPPING' },
                    production: { cls: 'chip-prod', lbl: 'IN PROD.' },
                    pending: { cls: 'chip-pend', lbl: 'PENDING' },
                    done: { cls: 'chip-done', lbl: 'DONE' }
                };

                return {
                    id: r[COLS.id] || '—',
                    client: r[COLS.client] || '—',
                    tarea: r[COLS.tarea] || '—',
                    date: dl,
                    imp: (r[COLS.importance] || '—').toUpperCase(),
                    cat,
                    chipClass: chips[cat].cls,
                    chipLabel: chips[cat].lbl
                };
            });

            items.sort((a, b) => (CAT_ORDER[a.cat] ?? 3) - (CAT_ORDER[b.cat] ?? 3));
            this.orders.list = items;
            this.orders.valShip = shipCount;
            this.orders.valProd = prodCount;
            this.orders.valPend = pendCount;

            if (this.refreshKey > 0 && shipCount > this.orders.prevShip) {
                this.toast('🚚', 'Shipping Alert', `${shipCount} order${shipCount > 1 ? 's' : ''} shipping today`, '#dc2626');
            }
            this.orders.prevShip = shipCount;
        },

        // --- Screen 03: EVENTS Logic ---
        processEvents(rows) {
            const COLS = { title: 0, date: 1, place: 2, time: 3, responsible: 4 };

            const isFuture = (s) => {
                const d = this.parseDate(s); if (!d) return false;
                const n = new Date(); n.setHours(0, 0, 0, 0); const dc = new Date(d); dc.setHours(0, 0, 0, 0); return dc > n;
            };

            const daysUntil = (s) => {
                const d = this.parseDate(s); if (!d) return null;
                const n = new Date(); n.setHours(0, 0, 0, 0); const dc = new Date(d); dc.setHours(0, 0, 0, 0);
                return Math.round((dc - n) / 86400000);
            };

            const valid = rows.filter(r => (r[COLS.title] || '').trim());
            const today = [], upcoming = [];

            valid.forEach(r => {
                if (this.isToday(r[COLS.date])) {
                    today.push({ title: r[COLS.title], time: r[COLS.time] || '', place: r[COLS.place] || '', responsible: r[COLS.responsible] || '' });
                } else if (isFuture(r[COLS.date])) {
                    const d = this.parseDate(r[COLS.date]);
                    const days = daysUntil(r[COLS.date]);
                    const dl = d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : (r[COLS.date] || '—');
                    const dn = d ? d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase() : '';
                    const cl = days === 1 ? 'TOMORROW' : days === 0 ? 'TODAY' : `IN ${days}D`;
                    const bc = days === 1 ? 'tomorrow' : days <= 3 ? 'soon' : 'normal';
                    upcoming.push({
                        title: r[COLS.title], time: r[COLS.time] || '', place: r[COLS.place] || '', responsible: r[COLS.responsible] || '',
                        dateLabel: dl, dayName: dn, countdownLabel: cl, badgeClass: bc, sortKey: d ? d.getTime() : 999999999
                    });
                }
            });

            upcoming.sort((a, b) => a.sortKey - b.sortKey);
            this.events.today = today;
            this.events.upcoming = upcoming;

            if (this.refreshKey > 0 && today.length > this.events.prevTodayCount) {
                this.toast('📅', 'New Event Today', today[today.length - 1].title, '#d97706');
            }
            this.events.prevTodayCount = today.length;
        }
    };
}
