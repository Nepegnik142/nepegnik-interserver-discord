<?php
session_start();
require_once __DIR__ . '/db/db.php';

$client_id = getenv('DISCORD_CLIENT_ID') ?: '';
$client_secret = getenv('DISCORD_CLIENT_SECRET') ?: '';
$redirect_uri = getenv('DISCORD_REDIRECT_URI') ?: 'https://ваш-адрес.для-защиты/discord_callback.php';
$scope = 'identify+email';

$pdo = getDbConnection();

if (!isset($_GET['code'])) {
    $_SESSION['error'] = 'Ошибка авторизации: код не получен.';
    header('Location: index.php');
    exit;
}

$code = $_GET['code'];

// --- 1. Получение Access Token ---
$token_url = 'https://discord.com/api/oauth2/token';
$data = [
    'client_id' => $client_id,
    'client_secret' => $client_secret,
    'grant_type' => 'authorization_code',
    'code' => $code,
    'redirect_uri' => $redirect_uri,
    'scope' => $scope
];

$options = [
    'http' => [
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'method' => 'POST',
        'content' => http_build_query($data),
    ]
];

$context = stream_context_create($options);
$response = file_get_contents($token_url, false, $context);

if ($response === false) {
    $_SESSION['error'] = 'Ошибка при запросе токена от Discord.';
    header('Location: index.php');
    exit;
}

$token = json_decode($response, true);

if (isset($token['error'])) {
    $_SESSION['error'] = 'Ошибка Discord API: ' . ($token['error_description'] ?? $token['error']);
    header('Location: index.php');
    exit;
}

$access_token = $token['access_token'];

// --- 2. Получение данных пользователя ---
$user_url = 'https://discord.com/api/users/@me';
$opts = [
    'http' => [
        'header' => "Authorization: Bearer " . $access_token . "\r\n",
        'method' => 'GET'
    ]
];
$context = stream_context_create($opts);
$user_response = file_get_contents($user_url, false, $context);
$user = json_decode($user_response, true);

if (isset($user['error']) || !isset($user['id'])) {
    $_SESSION['error'] = 'Ошибка получения данных пользователя из Discord.';
    header('Location: index.php');
    exit;
}

$userId = $user['id'];

// --- 3. Работа с БД ---
try {
    // Проверяем профиль
    $stmt = $pdo->prepare("SELECT user_id FROM profiles WHERE user_id = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn()) {
        $insert = $pdo->prepare("INSERT INTO profiles (user_id, nick, description) VALUES (?, ?, ?)");
        $insert->execute([$userId, $user['username'], '']);
    }

    // Создаём таблицу user_tokens, если нет
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_tokens (
        user_id VARCHAR(32) PRIMARY KEY,
        token VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Генерируем и сохраняем токен для WebSocket
    $chatToken = bin2hex(random_bytes(32));
    $_SESSION['chat_token'] = $chatToken;

    $stmt = $pdo->prepare("INSERT INTO user_tokens (user_id, token) VALUES (?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token)");
    $stmt->execute([$userId, $chatToken]);

} catch (PDOException $e) {
    $_SESSION['error'] = 'Ошибка базы данных. Попробуйте позже.';
    error_log('DB error: ' . $e->getMessage());
    header('Location: index.php');
    exit;
}

// --- 4. Сохраняем в сессию ---
$_SESSION['user_logged_in'] = true;
$_SESSION['user_id'] = $userId;
$_SESSION['discord_user'] = $user;
$_SESSION['discord_user_access_token'] = $access_token;

// --- 5. Редирект ---
header('Location: index.php');
exit;