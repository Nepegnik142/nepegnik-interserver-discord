<?php
function loadEnv($path = __DIR__ . '/../.env') {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!$lines) return;
    foreach ($lines as $line) {
        $line = trim($line);
        if (strpos($line, '=') === false || strpos($line, '#') === 0) continue;
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (!getenv($key)) putenv("$key=$value");
        if (!isset($_ENV[$key])) $_ENV[$key] = $value;
    }
}
loadEnv();

function env($key, $default = '') {
    $val = getenv($key);
    if ($val === false) $val = $_ENV[$key] ?? $default;
    return $val;
}

function getApiBase() {
    $base = env('API_BASE', 'Замените');
    if (!$base) $base = 'http://замените';
    return rtrim($base, '/');
}

function getWsUrl() {
    return env('WS_URL', 'ws://замение');
}

function getDbConnection() {
    $host = env('DB_HOST', 'Замените');
    $name = env('DB_NAME', 'Замените');
    $user = env('DB_USER', 'Замените');
    $pass = env('DB_PASS', 'Замените');
    $charset = 'utf8mb4';

    $dsn = "mysql:host=$host;dbname=$name;charset=$charset";

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    return new PDO($dsn, $user, $pass, $options);
}
