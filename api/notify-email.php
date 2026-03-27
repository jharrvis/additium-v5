<?php
/**
 * ADDITIUM 3D – Email Notification Proxy (PHP / Apache / Laragon)
 * ---------------------------------------------------------------
 * Local equivalent of notify-email.js (Vercel).
 * Accessible at /api/notify-email via Apache URL rewriting (.htaccess).
 * Sends email via Resend API using cURL.
 *
 * On Vercel this file is ignored — notify-email.js handles the request instead.
 *
 * Endpoint: POST /api/notify-email
 * Body: { icon, title, msg, to?, tasks?: [{text, deadline}] }
 *
 * Configuration: create api/.env.php with putenv() calls (see .env.php.example).
 */

// Load local environment config if present
$envFile = __DIR__ . '/.env.php';
if (file_exists($envFile)) require_once $envFile;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$apiKey = getenv('RESEND_API_KEY');
if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'RESEND_API_KEY not configured. Create api/.env.php']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$icon    = $body['icon']  ?? '🔔';
$title   = $body['title'] ?? 'Notification';
$msg     = $body['msg']   ?? '';
$to      = $body['to']    ?? '';
$tasks   = $body['tasks'] ?? [];

$notifyEmail = getenv('NOTIFY_EMAIL') ?: '';
$toEmail = (is_string($to) && str_contains($to, '@')) ? $to : $notifyEmail;
if (!$toEmail) {
    http_response_code(400);
    echo json_encode(['error' => 'No recipient email provided']);
    exit;
}

$timestamp = (new DateTime('now', new DateTimeZone('Europe/Madrid')))->format('d/m/Y, H:i:s');

// Build tasks table HTML
$taskRows = '';
if (is_array($tasks) && count($tasks) > 0) {
    $taskRows = '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="text-align:left;padding:6px 10px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0">Tarea</th>
            <th style="text-align:left;padding:6px 10px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;white-space:nowrap">Vencimiento</th>
          </tr>
        </thead>
        <tbody>';
    foreach ($tasks as $i => $t) {
        $bg = ($i % 2 === 0) ? '#fff' : '#f8fafc';
        $taskText = htmlspecialchars($t['text'] ?? '', ENT_QUOTES);
        $taskDl   = htmlspecialchars($t['deadline'] ?? '—', ENT_QUOTES);
        $taskRows .= "<tr style=\"background:{$bg}\">
            <td style=\"padding:7px 10px;color:#1e293b;border-bottom:1px solid #f1f5f9\">{$taskText}</td>
            <td style=\"padding:7px 10px;color:#dc2626;font-family:monospace;border-bottom:1px solid #f1f5f9;white-space:nowrap\">{$taskDl}</td>
          </tr>";
    }
    $taskRows .= '</tbody></table>';
}

$msgMargin = $taskRows ? '16px' : '0';
$iconHtml  = htmlspecialchars($icon, ENT_QUOTES);
$titleHtml = htmlspecialchars($title, ENT_QUOTES);
$msgHtml   = htmlspecialchars($msg, ENT_QUOTES);

$html = <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:#0f172a;padding:20px 24px;display:flex;align-items:center;gap:12px">
      <span style="font-size:24px">{$iconHtml}</span>
      <span style="color:#fff;font-weight:700;font-size:16px;letter-spacing:0.05em">ADDITIUM 3D DASHBOARD</span>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px">{$titleHtml}</h2>
      <p style="margin:0 0 {$msgMargin};color:#64748b;font-size:14px;line-height:1.6">{$msgHtml}</p>
      {$taskRows}
    </div>
    <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <small style="color:#94a3b8;font-size:11px;font-family:monospace">{$timestamp}</small>
    </div>
  </div>
</body>
</html>
HTML;

$payload = json_encode([
    'from'    => 'Additium Dashboard <notifications@flcr.my.id>',
    'to'      => [$toEmail],
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

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_errno($ch);
if (PHP_VERSION_ID < 80500) curl_close($ch);

if ($curlErr || $response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'cURL error: ' . curl_strerror($curlErr)]);
    exit;
}

$data = json_decode($response, true) ?: [];
if ($httpCode < 200 || $httpCode >= 300) {
    http_response_code(502);
    $detail = $data['message'] ?? $data['name'] ?? $response;
    echo json_encode(['error' => $detail]);
    exit;
}

echo json_encode(['ok' => true, 'id' => $data['id'] ?? null]);
