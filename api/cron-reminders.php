<?php
/**
 * ADDITIUM 3D – Cron Reminders (PHP / Apache / Laragon)
 * -------------------------------------------------------
 * Local equivalent of cron-reminders.js (Vercel).
 * Can be run from CLI or as a web endpoint.
 *
 * On Vercel this file is ignored — cron-reminders.js handles the request instead.
 *
 * CLI usage (Windows Task Scheduler):
 *   php D:\laragon\www\contest\v5\api\cron-reminders.php
 *
 * Web usage (with CRON_SECRET):
 *   GET /api/cron-reminders  -H "Authorization: Bearer <CRON_SECRET>"
 *
 * Debug mode (web only):
 *   GET /api/cron-reminders?debug=1  -H "Authorization: Bearer <CRON_SECRET>"
 *
 * Configuration: create api/.env.php with putenv() calls (see .env.php.example).
 */

$isCli = php_sapi_name() === 'cli';

// Load local environment config if present
$envFile = __DIR__ . '/.env.php';
if (file_exists($envFile)) require_once $envFile;

if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');

    // Verify CRON_SECRET when accessed via web
    $cronSecret = getenv('CRON_SECRET');
    if ($cronSecret) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($auth !== "Bearer {$cronSecret}") {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
    }
}

$apiKey    = getenv('RESEND_API_KEY');
$mainEmail = getenv('NOTIFY_EMAIL') ?: '';
$isDebug   = !$isCli && isset($_GET['debug']) && $_GET['debug'] === '1';

if (!$apiKey) {
    $msg = 'RESEND_API_KEY not configured. Create api/.env.php';
    if ($isCli) { echo "[ERROR] {$msg}\n"; exit(1); }
    http_response_code(500);
    echo json_encode(['error' => $msg]);
    exit;
}

// ── Google Sheets URLs ───────────────────────────────────────────────────────
$SPREADSHEET_BASE =
    'https://docs.google.com/spreadsheets/d/e/' .
    '2PACX-1vQWIsIYz5xz3NNvpet3VCSYBNp_epEm90SXC7oEvETucI9SBia7GbZkyNyRXEoFt02h9nqxPtsKTJm2' .
    '/pub?output=csv&gid=';
$GID_TASKS        = '0';
$GID_TRABAJADORES = '89297275';

// ── Helper: fetch URL with cURL (follows redirects) ──────────────────────────
function fetchCsv(string $url): string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 12,
        CURLOPT_HTTPHEADER     => ['Cache-Control: no-cache, no-store', 'Pragma: no-cache'],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);
    $data = curl_exec($ch);
    if (PHP_VERSION_ID < 80500) curl_close($ch);
    return $data ?: '';
}

// ── Helper: simple CSV parser ────────────────────────────────────────────────
function parseCsv(string $text): array {
    $rows = []; $row = []; $cur = ''; $inQ = false;
    for ($i = 0; $i < strlen($text); $i++) {
        $c = $text[$i];
        if ($inQ) {
            if ($c === '"' && isset($text[$i+1]) && $text[$i+1] === '"') { $cur .= '"'; $i++; }
            elseif ($c === '"') { $inQ = false; }
            else { $cur .= $c; }
        } elseif ($c === '"') { $inQ = true; }
        elseif ($c === ',') { $row[] = $cur; $cur = ''; }
        elseif ($c === "\n") { $row[] = $cur; $rows[] = $row; $row = []; $cur = ''; }
        elseif ($c !== "\r") { $cur .= $c; }
    }
    if ($cur !== '' || count($row) > 0) { $row[] = $cur; $rows[] = $row; }
    return $rows;
}

// ── Helper: parse DD/MM/YYYY date string ─────────────────────────────────────
function parseDeadlineDate(string $s): ?DateTime {
    $s = trim($s);
    if (!$s) return null;
    $parts = explode('/', $s);
    if (count($parts) === 3) {
        $iso = sprintf('%04d-%02d-%02d', (int)$parts[2], (int)$parts[1], (int)$parts[0]);
        $d = DateTime::createFromFormat('Y-m-d', $iso);
        return $d ?: null;
    }
    $d = date_create($s);
    return $d ?: null;
}

// ── Helper: classify deadline day string (real dates only) ───────────────────
// Text-based values like "Hoy"/"Mañana" are skipped — they never expire and
// would trigger cron reminders every day indefinitely.
function classifyDeadline(string $dayStr, string $todayStr, string $tomorrowStr): ?string {
    $dl = parseDeadlineDate($dayStr);
    if ($dl) {
        $dlStr = $dl->format('Y-m-d');
        if ($dlStr === $todayStr) return 'today';
        if ($dlStr === $tomorrowStr) return 'tomorrow';
    }
    return null;
}

// ── Helper: send email via Resend API ────────────────────────────────────────
function sendEmail(string $apiKey, string $to, string $icon, string $title, string $msg, array $tasks = []): array {
    $timestamp = (new DateTime('now', new DateTimeZone('Europe/Madrid')))->format('d/m/Y, H:i:s');

    $taskRows = '';
    if (count($tasks) > 0) {
        $taskRows = '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
          <thead><tr style="background:#f1f5f9">
            <th style="text-align:left;padding:6px 10px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0">Tarea</th>
            <th style="text-align:left;padding:6px 10px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;white-space:nowrap">Vencimiento</th>
          </tr></thead><tbody>';
        foreach ($tasks as $i => $t) {
            $bg  = ($i % 2 === 0) ? '#fff' : '#f8fafc';
            $txt = htmlspecialchars($t['text'] ?? '', ENT_QUOTES);
            $dl  = htmlspecialchars($t['deadline'] ?? '—', ENT_QUOTES);
            $taskRows .= "<tr style=\"background:{$bg}\">
              <td style=\"padding:7px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9\">{$txt}</td>
              <td style=\"padding:7px 10px;color:#dc2626;font-family:monospace;border-bottom:1px solid #f1f5f9;white-space:nowrap\">{$dl}</td>
            </tr>";
        }
        $taskRows .= '</tbody></table>';
    }

    $msgMargin = $taskRows ? '16px' : '0';
    $iH = htmlspecialchars($icon, ENT_QUOTES);
    $tH = htmlspecialchars($title, ENT_QUOTES);
    $mH = htmlspecialchars($msg, ENT_QUOTES);

    $html = <<<HTML
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:#0f172a;padding:20px 24px;display:flex;align-items:center;gap:12px">
      <span style="font-size:24px">{$iH}</span>
      <span style="color:#fff;font-weight:700;font-size:16px;letter-spacing:0.05em">ADDITIUM 3D DASHBOARD</span>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px">{$tH}</h2>
      <p style="margin:0 0 {$msgMargin};color:#64748b;font-size:14px;line-height:1.6">{$mH}</p>
      {$taskRows}
    </div>
    <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <small style="color:#94a3b8;font-size:11px;font-family:monospace">{$timestamp}</small>
    </div>
  </div>
</body></html>
HTML;

    $payload = json_encode([
        'from'    => 'Additium Dashboard <notifications@flcr.my.id>',
        'to'      => [$to],
        'subject' => "[Additium] {$title}",
        'html'    => $html,
    ]);

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            "Authorization: Bearer {$apiKey}",
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (PHP_VERSION_ID < 80500) curl_close($ch);

    return ['status' => $code, 'data' => json_decode($resp ?: '{}', true)];
}

// ── Main ─────────────────────────────────────────────────────────────────────

// 1. Fetch worker emails from Trabajadores sheet
$workerCSV  = fetchCsv($SPREADSHEET_BASE . $GID_TRABAJADORES . '&t=' . time());
$workerRows = parseCsv($workerCSV);
$header     = $workerRows[0] ?? [];
$nc = 1; $ec = 2; // default: col 1 = NAME, col 2 = EMAIL
foreach ($header as $i => $h) {
    $h = strtolower(trim($h));
    if ($h === 'name' || $h === 'nombre') $nc = $i;
    if ($h === 'email' || $h === 'correo') $ec = $i;
}
$workerEmails = [];
for ($i = 1; $i < count($workerRows); $i++) {
    $r     = $workerRows[$i];
    $name  = strtoupper(trim($r[$nc] ?? ''));
    $email = trim($r[$ec] ?? '');
    if ($name && str_contains($email, '@')) $workerEmails[$name] = $email;
}

// 2. Fetch tasks
$tasksCSV  = fetchCsv($SPREADSHEET_BASE . $GID_TASKS . '&t=' . time());
$taskRows  = parseCsv($tasksCSV);

// Date helpers (Madrid timezone)
$madridTz   = new DateTimeZone('Europe/Madrid');
$now        = new DateTime('now', $madridTz);
$todayStr   = $now->format('Y-m-d');
$tomorrow   = (clone $now)->modify('+1 day');
$tomorrowStr = $tomorrow->format('Y-m-d');
$isMonday   = (int)$now->format('N') === 1;

// 3. Parse tasks, group by worker
$byWorker = [];
for ($i = 1; $i < count($taskRows); $i++) {
    $row    = $taskRows[$i];
    $has7   = count($row) >= 7;
    $worker = strtoupper(trim($row[$has7 ? 1 : 0] ?? ''));
    $task   = trim($row[$has7 ? 2 : 1] ?? '');
    $status = strtoupper(trim($row[$has7 ? 4 : 3] ?? ''));
    $dayStr = trim($row[$has7 ? 5 : 4] ?? '');
    $timeStr= trim($row[$has7 ? 6 : 5] ?? '');
    if (!$worker || !$task || $task === '—') continue;
    $isDone = str_contains($status, 'COMPLET') || str_contains($status, 'DONE') ||
              str_contains($status, 'TERMINAD') || str_contains($status, 'ENVIADO');
    if (!isset($byWorker[$worker])) $byWorker[$worker] = ['today' => [], 'tomorrow' => [], 'all' => []];
    if (!$isDone) {
        $dl = array_filter([$dayStr, $timeStr]);
        $deadlineLabel = implode(' ', $dl) ?: '—';
        $entry = ['text' => $task, 'deadline' => $deadlineLabel];
        $byWorker[$worker]['all'][] = $entry;
        $bucket = classifyDeadline($dayStr, $todayStr, $tomorrowStr);
        if ($bucket) $byWorker[$worker][$bucket][] = $entry;
    }
}

// Debug mode (web only) — return parsed data without sending emails
if ($isDebug) {
    echo json_encode([
        'debug'          => true,
        'today'          => $todayStr,
        'tomorrow'       => $tomorrowStr,
        'isMonday'       => $isMonday,
        'workerEmails'   => $workerEmails,
        'workerCSVSnippet' => substr($workerCSV, 0, 300),
        'byWorker'       => $byWorker,
        'mainEmail'      => $mainEmail ?: null,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. Send per-worker deadline reminders
$results = [];
foreach ($byWorker as $worker => $data) {
    $email = $workerEmails[$worker] ?? null;
    if (!$email) continue;
    if (count($data['today']) > 0) {
        $n   = count($data['today']);
        $r   = sendEmail($apiKey, $email, '🔴',
            "[{$worker}] Tareas vencen HOY",
            "{$n} tarea" . ($n > 1 ? 's vencen' : ' vence') . " hoy. Por favor revisa y actualiza el estado.",
            $data['today']);
        $results[] = ['worker' => $worker, 'type' => 'today', 'email' => $email, 'status' => $r['status']];
        if ($isCli) echo "[{$worker}] today → {$email} (HTTP {$r['status']})\n";
    }
    if (count($data['tomorrow']) > 0) {
        $n   = count($data['tomorrow']);
        $r   = sendEmail($apiKey, $email, '⚠️',
            "[{$worker}] Tareas vencen MAÑANA",
            "{$n} tarea" . ($n > 1 ? 's vencen' : ' vence') . " mañana. Recuerda completarlas a tiempo.",
            $data['tomorrow']);
        $results[] = ['worker' => $worker, 'type' => 'tomorrow', 'email' => $email, 'status' => $r['status']];
        if ($isCli) echo "[{$worker}] tomorrow → {$email} (HTTP {$r['status']})\n";
    }
}

// 5. Monday weekly summary → main email
if ($isMonday && $mainEmail) {
    $allActive = [];
    foreach ($byWorker as $worker => $data) {
        foreach ($data['all'] as $t) {
            $allActive[] = ['text' => "[{$worker}] {$t['text']}", 'deadline' => $t['deadline']];
        }
    }
    if (count($allActive) > 0) {
        $n   = count($allActive);
        $r   = sendEmail($apiKey, $mainEmail, '📋',
            'Resumen Semanal de Tareas',
            "{$n} tarea" . ($n > 1 ? 's activas' : ' activa') . " esta semana.",
            $allActive);
        $results[] = ['type' => 'weekly', 'email' => $mainEmail, 'status' => $r['status']];
        if ($isCli) echo "[weekly] → {$mainEmail} (HTTP {$r['status']})\n";
    }
}

$sent = count($results);
if ($isCli) {
    echo "[cron-reminders] done. Sent: {$sent}\n";
} else {
    echo json_encode(['ok' => true, 'sent' => $sent, 'results' => $results]);
}
