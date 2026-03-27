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
    'tasks'    => '0',
    'orders'   => '859622579',
    'events'   => '2006704627',
    'machines' => '348601046',
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

// Use cURL (more reliable on Windows/Laragon for HTTPS)
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 12,
        CURLOPT_HTTPHEADER     => ['Cache-Control: no-cache, no-store', 'Pragma: no-cache'],
        CURLOPT_SSL_VERIFYPEER => false, // Laragon localhost — CA bundle not required
        CURLOPT_SSL_VERIFYHOST => false,
    ]);
    $data  = curl_exec($ch);
    $errno = curl_errno($ch);
    $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (PHP_VERSION_ID < 80500) curl_close($ch);

    if ($errno || $data === false || $code < 200 || $code >= 300) {
        http_response_code(502);
        echo 'Failed to fetch data from Google Sheets (cURL errno=' . $errno . ' http=' . $code . ')';
        exit;
    }
} else {
    // Fallback: file_get_contents
    $context = stream_context_create([
        'http' => [
            'method'          => 'GET',
            'header'          => "Cache-Control: no-cache, no-store\r\nPragma: no-cache\r\n",
            'timeout'         => 12,
            'ignore_errors'   => true,
            'follow_location' => 1,
            'max_redirects'   => 5,
        ],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $data = @file_get_contents($url, false, $context);

    if ($data === false) {
        http_response_code(502);
        echo 'Failed to fetch data from Google Sheets';
        exit;
    }
}

echo $data;
