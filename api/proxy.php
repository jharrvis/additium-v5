<?php
/**
 * ADDITIUM 3D – Google Sheets CSV Proxy (PHP / Apache / Laragon)
 * ---------------------------------------------------------------
 * Accessible at /api/proxy?sheet=tasks via Apache URL rewriting (.htaccess).
 * Fetches spreadsheet data server-side so Google's CDN cache is bypassed.
 *
 * On Vercel this file is ignored — api/proxy.js handles the request instead.
 */

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/plain; charset=utf-8');

$SHEETS = [
    'tasks'  => '0',
    'orders' => '859622579',
    'events' => '2006704627',
];

$SPREADSHEET_BASE =
    'https://docs.google.com/spreadsheets/d/e/' .
    '2PACX-1vQWIsIYz5xz3NNvpet3VCSYBNp_epEm90SXC7oEvETucI9SBia7GbZkyNyRXEoFt02h9nqxPtsKTJm2' .
    '/pub?output=csv&gid=';

$sheet = isset($_GET['sheet']) ? (string) $_GET['sheet'] : '';
if (!array_key_exists($sheet, $SHEETS)) {
    http_response_code(400);
    echo 'Bad request: invalid sheet name. Use: tasks | orders | events';
    exit;
}

$url = $SPREADSHEET_BASE . $SHEETS[$sheet] . '&t=' . time();

$context = stream_context_create([
    'http' => [
        'method'          => 'GET',
        'header'          => "Cache-Control: no-cache, no-store\r\nPragma: no-cache\r\n",
        'timeout'         => 12,
        'ignore_errors'   => true,
        'follow_location' => 1,
        'max_redirects'   => 5,
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
