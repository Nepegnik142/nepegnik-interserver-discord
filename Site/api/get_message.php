<?php
session_start();
require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json');

$response = ['success' => false, 'messages' => [], 'error' => null];

try {
    $pdo = getDbConnection();
    if (!$pdo) {
        throw new Exception('Не удалось подключиться к БД');
    }

    $lastId = isset($_GET['last_id']) ? (int)$_GET['last_id'] : 0;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;

    if ($lastId > 0) {
        $stmt = $pdo->prepare("SELECT id, author, text, guild, created_at FROM chat_messages WHERE id > ? ORDER BY id ASC");
        $stmt->execute([$lastId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $response['success'] = true;
        $response['messages'] = $rows;
    } else {
        $stmt = $pdo->prepare("SELECT id, author, text, guild, created_at FROM chat_messages ORDER BY id DESC LIMIT ?");
        $stmt->execute([$limit]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $rows = array_reverse($rows);
        $response['success'] = true;
        $response['messages'] = $rows;
    }
} catch (Exception $e) {
    $response['error'] = $e->getMessage();
    error_log('get_messages error: ' . $e->getMessage());
}

echo json_encode($response);