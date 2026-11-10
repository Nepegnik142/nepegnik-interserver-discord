<?php
session_start();
require_once __DIR__ . '/../db/db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_logged_in']) || $_SESSION['user_logged_in'] !== true) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$userId = $_SESSION['user_id'];
$pdo = getDbConnection();
$stmt = $pdo->prepare("SELECT level FROM admins WHERE user_id = ?");
$stmt->execute([$userId]);
$level = (int) $stmt->fetchColumn();
if ($level < 7) {
    http_response_code(403);
    echo json_encode(['error' => 'Insufficient permissions']);
    exit;
}

$stmt = $pdo->query("SELECT * FROM bans WHERE active=1 ORDER BY created_at DESC");
$bans = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['bans' => $bans]);
