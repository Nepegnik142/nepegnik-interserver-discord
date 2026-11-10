<?php
// Проверка токена для бота (WebSocket-сервер)
require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json');

$token = $_GET['token'] ?? 'Замените тут токен';
$userId = $_GET['user_id'] ?? null;

if (empty($token)) {
    http_response_code(400);
    echo json_encode(['valid' => false, 'error' => 'Token required']);
    exit;
}

try {
    $pdo = getDbConnection();

    // Убедимся, что таблица user_tokens существует
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_tokens (
        user_id VARCHAR(32) PRIMARY KEY,
        token VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Поиск токена
    $stmt = $pdo->prepare("SELECT user_id FROM user_tokens WHERE token = ?");
    $stmt->execute([$token]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode(['valid' => false, 'error' => 'Invalid token']);
        exit;
    }

    $foundUserId = $row['user_id'];

    // Если передан userId, проверяем совпадение
    if ($userId !== null && $foundUserId !== $userId) {
        echo json_encode(['valid' => false, 'error' => 'User mismatch']);
        exit;
    }

    // Получаем ник из профиля
    $stmt2 = $pdo->prepare("SELECT nick FROM profiles WHERE user_id = ?");
    $stmt2->execute([$foundUserId]);
    $profile = $stmt2->fetch(PDO::FETCH_ASSOC);
    $username = $profile['nick'] ?? 'Пользователь';

    // Получаем уровень администратора
    $stmt3 = $pdo->prepare("SELECT level FROM admins WHERE user_id = ?");
    $stmt3->execute([$foundUserId]);
    $adminLevel = (int) $stmt3->fetchColumn();

    echo json_encode([
        'valid' => true,
        'user_id' => $foundUserId,
        'username' => $username,
        'admin_level' => $adminLevel
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['valid' => false, 'error' => 'Database error: ' . $e->getMessage()]);
}