<?php
session_start();
require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json');

$response = ['success' => false, 'error' => null];

try {
    $pdo = getDbConnection();
    if (!$pdo) {
        throw new Exception('Не удалось подключиться к БД');
    }

    $isLoggedIn = isset($_SESSION['user_logged_in']) && $_SESSION['user_logged_in'] === true;
    $userId = $_SESSION['user_id'] ?? null;
    $sessionToken = $_SESSION['chat_token'] ?? null;

    if (!$isLoggedIn || !$userId) {
        throw new Exception('Не авторизован');
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['text']) || !isset($input['token'])) {
        throw new Exception('Неверный запрос');
    }

    $text = trim($input['text']);
    $author = trim($input['author'] ?? 'Пользователь');
    $token = trim($input['token']);

    if (empty($text)) {
        throw new Exception('Сообщение не может быть пустым');
    }

    // Проверка токена
    if ($token !== $sessionToken) {
        $stmt = $pdo->prepare("SELECT user_id FROM user_tokens WHERE token = ? AND user_id = ?");
        $stmt->execute([$token, $userId]);
        if (!$stmt->fetch()) {
            throw new Exception('Неверный токен');
        }
    }

    // Попытка отправить через API бота
    $apiUrl = getApiBase() . 'http://Замените-тут-IP-вашего-бота/api/send-chat';
    $payload = json_encode(['text' => $text, 'token' => $token]);
    $options = [
        'http' => [
            'header'  => "Content-Type: application/json\r\n",
            'method'  => 'POST',
            'content' => $payload,
            'timeout' => 5,
        ],
    ];
    $context = stream_context_create($options);
    $result = @file_get_contents($apiUrl, false, $context);

    if ($result) {
        $decoded = json_decode($result, true);
        if (isset($decoded['ok']) && $decoded['ok']) {
            $response['success'] = true;
            $response['sent'] = $decoded['sent'] ?? 0;
            echo json_encode($response);
            exit;
        }
    }

    // Фолбек: сохраняем локально, если бот недоступен
    $stmt = $pdo->prepare("INSERT INTO chat_messages (author, text, guild, type) VALUES (?, ?, ?, ?)");
    $guild = 'Сайт';
    $stmt->execute([$author, $text, $guild, 'message']);
    $messageId = $pdo->lastInsertId();

    $response['success'] = true;
    $response['id'] = $messageId;
} catch (Exception $e) {
    $response['error'] = $e->getMessage();
    error_log('send_message error: ' . $e->getMessage());
}

echo json_encode($response);
