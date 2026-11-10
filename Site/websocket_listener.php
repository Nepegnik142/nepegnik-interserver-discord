<?php
require __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/db/db.php';
use WebSocket\Client;

$apiKey = 'ключ';
$wsUrl = getWsUrl() . "?api_key={$apiKey}";
$pdo = getDbConnection(); // ваша функция подключения

while (true) {
    try {
        $client = new Client($wsUrl);
        echo "Подключено к WebSocket\n";
        while ($message = $client->receive()) {
            $data = json_decode($message, true);
            if ($data && isset($data['type'])) {
                $type = $data['type'] ?? 'message';
                $author = $data['author'] ?? 'Unknown';
                $guild = $data['guild'] ?? 'Unknown';
                $text = $data['text'] ?? '';

                // Сохраняем в БД с типом
                $stmt = $pdo->prepare("INSERT INTO chat_messages (author, guild, text, type, created_at) VALUES (?, ?, ?, ?, NOW())");
                $stmt->execute([$author, $guild, $text, $type]);

                // Лог в консоль с указанием типа
                $typeLabel = $type === 'osay' ? '[OSAY]' : ($type === 'rainbow' ? '[RAINBOW]' : '[MSG]');
                echo date('Y-m-d H:i:s') . " $typeLabel [{$guild}] {$author}: {$text}\n";
            }
        }
    } catch (Exception $e) {
        echo "Ошибка: " . $e->getMessage() . "\n";
        sleep(5);
    }
}
if ($row) {
    // Проверяем, является ли пользователь админом
    $stmtAdmin = $pdo->prepare("SELECT level FROM admins WHERE user_id = ?");
    $stmtAdmin->execute([$row['user_id']]);
    $adminLevel = $stmtAdmin->fetchColumn();
    $isAdmin = ($adminLevel !== false && $adminLevel >= 1);
    
    // Получаем имя
    $stmt2 = $pdo->prepare("SELECT nick FROM profiles WHERE user_id = ?");
    $stmt2->execute([$row['user_id']]);
    $profile = $stmt2->fetch();
    $username = $profile['nick'] ?? 'Пользователь';
    
    echo json_encode([
        'valid' => true,
        'user_id' => $row['user_id'],
        'username' => $username,
        'is_admin' => $isAdmin,
        'admin_level' => $adminLevel ? (int)$adminLevel : 0
    ]);
} else {
    echo json_encode(['valid' => false, 'error' => 'Invalid token']);
}