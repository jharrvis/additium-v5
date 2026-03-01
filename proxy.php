<?php
/**
 * ADDITIUM 3D – Google Sheets CSV Proxy
 * --------------------------------------
 * Fetches spreadsheet data server-side so Google's CDN cache is bypassed.
 * Browser always gets a fresh response because it talks to this server, not
 * directly to Google.
 *
 * Usage: proxy.php?sheet=tasks | orders | events
 */

// ── No-cache response headers ──────────────────────────────────────────────
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/plain; charset=utf-8');

// ── Sheet name → GID mapping (keep in sync with config.js) ────────────────
$SHEETS = [
    'tasks'  => '0',
    'orders' => '859622579',
    'events' => '2006704627',
];

$SPREADSHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/'
    . '2PACX-1vQWIsIYz5xz3NNvpet3VCSYBNp_epEm90SXC7oEvETucI9SBia7GbZkyNyRXEoFt02h9nqxPtsKTJm2'
    . '/pub?output=csv&gid=';

// ── Validate input ─────────────────────────────────────────────────────────
$sheet = isset($_GET['sheet']) ? (string) $_GET['sheet'] : '';
if (!array_key_exists($sheet, $SHEETS)) {
    http_response_code(400);
    echo 'Bad request: invalid sheet name';
    exit;
}

// ── Build URL (timestamp busts Google's own CDN cache layer) ───────────────
$url = $SPREADSHEET_BASE . $SHEETS[$sheet] . '&t=' . time();

// ── Fetch from Google with no-cache request headers ────────────────────────
$context = stream_context_create([
    'http' => [
        'method'        => 'GET',
        'header'        => "Cache-Control: no-cache, no-store\r\nPragma: no-cache\r\n",
        'timeout'       => 12,
        'ignore_errors' => true,
        'follow_location' => 1,
        'max_redirects' => 5,
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$data = @file_get_contents($url, false, $context);

if ($data === false) {
    http_response_code(502);
    echo 'Failed to fetch data from Google Sheets';
    exit;
}

echo $data;
