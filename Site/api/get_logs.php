<?php
session_start();
require_once __DIR__ . '/../db/db.php';

if (!isset($_SESSION['user_logged_in']) || $_SESSION['user_logged_in'] !== true) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$userId = $_SESSION['user_id'];
// Проверяем уровень админа (должен быть >= 7)
$pdo = getDbConnection();
$stmt = $pdo->prepare("SELECT level FROM admins WHERE user_id = ?");
$stmt->execute([$userId]);
$level = (int) $stmt->fetchColumn();
if ($level < 7) {
    http_response_code(403);
    echo json_encode(['error' => 'Insufficient permissions']);
    exit;
}

// Получаем последние 100 логов
$stmt = $pdo->query("SELECT * FROM action_logs ORDER BY created_at DESC LIMIT 100");
$logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['logs' => $logs]);