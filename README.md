# Additium 3D Dashboard

A real-time production dashboard for Additium 3D, built as a single-page application (SPA) using Alpine.js. Reads live data from Google Sheets and supports browser/email/cron notifications.

**Live demo:** https://additium.vercel.app

---

## Features

- Real-time sync from Google Sheets (tasks, orders, events, machines) every 30 seconds
- Auto-rotating screens: Tasks, Orders, Events, Machines, Worker detail views
- Toast notifications, Browser/OS notifications, and Email notifications via Resend
- Server-side cron job for daily deadline reminders and weekly summaries
- Dual deployment: **Laragon/Apache (local)** and **Vercel (production)**

---

## Tech Stack

| Layer | Local | Vercel |
|-------|-------|--------|
| Frontend | Static HTML + Alpine.js | Static HTML + Alpine.js |
| API proxy | PHP + Apache `.htaccess` | Node.js serverless functions |
| Email | PHP + cURL → Resend API | Node.js fetch → Resend API |
| Cron | Windows Task Scheduler + PHP | Vercel Cron Jobs |
| Data source | Google Sheets (published CSV) | Google Sheets (published CSV) |

---

## Prerequisites

### For Local (Windows + Laragon)
- [Laragon](https://laragon.org/) with Apache and PHP 8.1+
- PHP extensions: `curl`, `json` (enabled by default in Laragon)
- Git

### For Vercel Deployment
- [Node.js](https://nodejs.org/) 18+
- [Vercel CLI](https://vercel.com/docs/cli): `npm install -g vercel`
- Git + GitHub account
- [Resend](https://resend.com) account with verified domain

---

## Local Setup (Laragon / Windows)

### 1. Clone the repository

```bash
git clone https://github.com/jharrvis/additium-v5.git
cd additium-v5
```

Place the project inside Laragon's `www` directory, e.g.:
```
D:\laragon\www\contest\v5\
```

### 2. Configure local environment

Copy the environment template:
```bash
copy api\.env.php.example api\.env.php
```

Edit `api/.env.php` with your credentials:
```php
<?php
putenv('RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx');
putenv('NOTIFY_EMAIL=your-email@example.com');
putenv('CRON_SECRET=your-random-secret-here');
```

> `api/.env.php` is gitignored — it will never be committed.

### 3. Verify Laragon configuration

Ensure Laragon is running with:
- **Apache** web server
- **PHP 8.1+** with `curl` extension enabled

The `api/.htaccess` file handles URL rewriting automatically:
- `/api/proxy` → `api/proxy.php`
- `/api/notify-email` → `api/notify-email.php`
- `/api/cron-reminders` → `api/cron-reminders.php`

### 4. Access the dashboard

Open your browser at:
```
http://localhost/contest/v5
```

### 5. Test email notifications

In the dashboard Settings panel, enable **Email Notifications** and click **Test**. You should receive an email from `notifications@flcr.my.id`.

### 6. Set up automatic cron reminders (Windows Task Scheduler)

To run deadline reminders daily at 7:00 AM:

1. Open **Task Scheduler** (search in Start menu)
2. Click **Create Basic Task**
3. Configure:
   - **Name:** Additium Cron Reminders
   - **Trigger:** Daily at 07:00
   - **Action:** Start a program
   - **Program:** `C:\laragon\bin\php\php8.x\php.exe` *(adjust PHP version)*
   - **Arguments:** `D:\laragon\www\contest\v5\api\cron-reminders.php`
4. Click **Finish**

**Manual test from terminal:**
```bash
php D:\laragon\www\contest\v5\api\cron-reminders.php
```

Expected output:
```
[CARLOS] today → carlos@additium3d.com (HTTP 200)
[JASON] today → jason@additium3d.com (HTTP 200)
[cron-reminders] done. Sent: 2
```

---

## Vercel Deployment

### 1. Install Vercel CLI and login

```bash
npm install -g vercel
vercel login
```

### 2. Link the project

```bash
cd path/to/additium-v5
vercel link
```

### 3. Set environment variables

Go to **Vercel Dashboard → Project → Settings → Environment Variables** and add:

| Variable | Value | Description |
|----------|-------|-------------|
| `RESEND_API_KEY` | `re_xxxxxxxxxx` | From [resend.com/api-keys](https://resend.com/api-keys) |
| `NOTIFY_EMAIL` | `your-email@example.com` | Main recipient for weekly summary |
| `CRON_SECRET` | `your-random-secret` | Protects the cron endpoint |

### 4. Deploy to production

```bash
vercel --prod
```

### 5. Verify cron job

After deploying, go to **Vercel Dashboard → Project → Cron Jobs**. You should see:

```
/api/cron-reminders    0 6 * * *    (daily at 06:00 UTC = 07:00 Madrid)
```

### 6. Manual cron test

```bash
curl https://additium.vercel.app/api/cron-reminders \
  -H "Authorization: Bearer your-random-secret"
```

### 7. Debug cron (shows parsed data without sending emails)

```bash
curl "https://additium.vercel.app/api/cron-reminders?debug=1" \
  -H "Authorization: Bearer your-random-secret"
```

---

## Google Sheets Structure

The dashboard reads from a **publicly published** Google Spreadsheet. The sheets and their column structures:

### TO_DO LIST (Tasks)
Supports both 6-column and 7-column formats:

| Col | 7-col | 6-col |
|-----|-------|-------|
| 0 | ID | Worker |
| 1 | Worker | Task |
| 2 | Task | Priority |
| 3 | Priority | Status |
| 4 | Status | Day (deadline) |
| 5 | Day (deadline) | Time (deadline) |
| 6 | Time (deadline) | — |

**Deadline formats accepted:**
- `Hoy` / `HOY` → sends reminder today
- `Mañana` / `MAÑANA` → sends reminder tomorrow
- `DD/MM/YYYY` → standard date format

**Priority values:** `URGENTE`, `ALTA`, `NORMAL`, `BAJA`

**Status values (done — excluded from reminders):** `COMPLETADO`, `DONE`, `TERMINADO`, `ENVIADO`

### Pedidos (Orders)
Order tracking with status (fabricating, ready to ship, etc.)

### Eventos (Events)
Calendar events with date/time for today and upcoming alerts.

### Máquinas (Machines)
Machine status and availability tracking.

### Trabajadores (Workers)
Worker contact information used by the cron job for per-worker email reminders.

| Column | Description |
|--------|-------------|
| NAME | Worker name (must match name in Tasks sheet, uppercase) |
| EMAIL | Worker email address |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/proxy?sheet=tasks` | GET | Fetch tasks CSV from Google Sheets |
| `/api/proxy?sheet=orders` | GET | Fetch orders CSV |
| `/api/proxy?sheet=events` | GET | Fetch events CSV |
| `/api/proxy?sheet=machines` | GET | Fetch machines CSV |
| `/api/notify-email` | POST | Send email notification via Resend |
| `/api/cron-reminders` | GET | Run deadline reminders (requires `Authorization: Bearer <CRON_SECRET>`) |
| `/api/cron-reminders?debug=1` | GET | Debug mode — show parsed data without sending emails |

### POST `/api/notify-email`

Request body:
```json
{
  "icon": "🚨",
  "title": "Alert Title",
  "msg": "Message body",
  "to": "recipient@example.com",
  "tasks": [
    { "text": "Task name", "deadline": "Hoy 14:00" }
  ]
}
```

Response:
```json
{ "ok": true, "id": "resend-email-id" }
```

---

## Email Notification System

### Real-time (browser-triggered)
Triggered when the dashboard detects new data during sync:

| Event | Recipient | Condition |
|-------|-----------|-----------|
| 🚨 Urgent task added | `settings.notifyEmail` | `emailNotify` enabled in Settings |
| 🚚 Order ready to ship | `settings.notifyEmail` | `emailNotify` enabled |
| 🏭 Order in production | `settings.notifyEmail` | `emailNotify` enabled |
| 📅 New event today | `settings.notifyEmail` | `emailNotify` enabled |
| 🗓️ New upcoming event | `settings.notifyEmail` | `emailNotify` enabled |
| 🚨 Worker urgent task | Per-worker email | `workerEmailNotify` enabled + email configured |

Email throttle: max 1 email per event type per **5 minutes** (stored in `localStorage`).

### Scheduled (cron-triggered, server-side)
Runs daily at **06:00 UTC (07:00 Madrid)**. Does NOT require browser to be open.

| Event | Recipient | Condition |
|-------|-----------|-----------|
| 🔴 Tasks due today | Worker email (from Trabajadores sheet) | Task deadline = today |
| ⚠️ Tasks due tomorrow | Worker email | Task deadline = tomorrow |
| 📋 Weekly summary | `NOTIFY_EMAIL` env var | Every Monday |

---

## Project Structure

```
additium-v5/
├── index.html                 # SPA entry point
├── js/
│   ├── app.js                 # Alpine.js application logic
│   └── config.js              # Configuration, translations, sheet mappings
├── css/
│   └── app.css                # Styles
├── img/                       # Images and icons
├── api/
│   ├── proxy.js               # Vercel: Google Sheets proxy
│   ├── proxy.php              # Local: Google Sheets proxy (Apache/Laragon)
│   ├── notify-email.js        # Vercel: Send email via Resend
│   ├── notify-email.php       # Local: Send email via Resend (Apache/Laragon)
│   ├── cron-reminders.js      # Vercel: Daily cron reminders
│   ├── cron-reminders.php     # Local: Daily cron reminders (CLI/Apache)
│   ├── .htaccess              # Apache URL rewriting for local PHP routing
│   ├── .env.php               # Local secrets — NOT committed (gitignored)
│   └── .env.php.example       # Template for .env.php
├── vercel.json                # Vercel routing + cron schedule
├── .vercelignore              # Files excluded from Vercel deployment
└── README.md                  # This file
```

---

## Resend Email Setup

1. Create a free account at [resend.com](https://resend.com)
2. Verify your domain (e.g., `yourdomain.com`) at [resend.com/domains](https://resend.com/domains)
3. Create an API key at [resend.com/api-keys](https://resend.com/api-keys)
4. Update the `from` address in `api/notify-email.js` and `api/notify-email.php`:
   ```
   notifications@yourdomain.com
   ```
5. Set `RESEND_API_KEY` in Vercel environment variables and `api/.env.php`

> Without a verified domain, Resend restricts sending to only the account owner's email address.

---

## Development Workflow

```bash
# Make changes locally
# Test at http://localhost/contest/v5

# Commit changes
git add .
git commit -m "Description of changes"
git push origin master

# Deploy to Vercel
vercel --prod
```

---

## License

Private project — Additium 3D © 2026
