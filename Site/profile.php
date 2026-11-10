<?php
session_start();
require_once __DIR__ . '/db/db.php';

$pdo = getDbConnection();

$isLoggedIn = isset($_SESSION['user_logged_in']) && $_SESSION['user_logged_in'] === true;
$userId = $_SESSION['user_id'] ?? null;

if (!$isLoggedIn || !$userId) {
    header('Location: index.php');
    exit;
}

// Получаем данные пользователя
$userData = null;
try {
    $stmt = $pdo->prepare("SELECT nick, description FROM profiles WHERE user_id = ?");
    $stmt->execute([$userId]);
    $userData = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log("Ошибка профиля: " . $e->getMessage());
}

$userName = $_SESSION['discord_user']['username'] ?? 'Пользователь';
$userDiscordTag = htmlspecialchars($userName);
$userNicknameInServer = htmlspecialchars($userData['nick'] ?? '');
$userDescription = htmlspecialchars($userData['description'] ?? '');

// Проверка VIP
$hasVIP = false;
try {
    $stmt = $pdo->prepare("SELECT 1 FROM vip WHERE user_id = ?");
    $stmt->execute([$userId]);
    $hasVIP = (bool)$stmt->fetchColumn();
} catch (Exception $e) {}

// Получение уровня администратора
$adminLevel = 0;
try {
    $stmt = $pdo->prepare("SELECT level FROM admins WHERE user_id = ?");
    $stmt->execute([$userId]);
    $adminLevel = (int) $stmt->fetchColumn();
} catch (Exception $e) {}

// Генерация токена для WebSocket/API (если ещё нет)
if (empty($_SESSION['chat_token'])) {
    $_SESSION['chat_token'] = bin2hex(random_bytes(32));
    try {
        $stmt = $pdo->prepare("INSERT INTO user_tokens (user_id, token) VALUES (?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token)");
        $stmt->execute([$userId, $_SESSION['chat_token']]);
    } catch (PDOException $e) {
        error_log("Token save error: " . $e->getMessage());
    }
}
$chatToken = $_SESSION['chat_token'];

// Функция для получения ссылки на оплату товара
function getPaymentLink($data) {
    $apiUrl = getApiBase() . '/api/payment-link';
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    $res = curl_exec($ch);
    curl_close($ch);
    $decoded = json_decode($res, true);
    return $decoded['ok'] ? ($decoded['paymentUrl'] ?? false) : false;
}

$error = '';
if (isset($_GET['action']) && $_GET['action'] === 'buy' && isset($_GET['type'])) {
    $type = $_GET['type'];
    $itemId = $_GET['item'] ?? '';
    $custom = $_GET['custom'] ?? '';
    $payload = [
        'userId' => $userId,
        'token' => $chatToken,
        'type' => $type,
    ];
    if ($itemId) $payload['itemId'] = $itemId;
    if ($custom) $payload['custom'] = $custom;

    $link = getPaymentLink($payload);
    if ($link) {
        header('Location: ' . $link);
        exit;
    } else {
        $error = 'Ошибка получения ссылки на оплату.';
    }
}

// Загружаем каталог из API бота (фолбек — локальные значения)
$shop = ['vip' => [], 'prefixes' => [], 'colors' => [], 'cases' => [], 'donateAmounts' => []];
$shopJson = @file_get_contents(getApiBase() . '/api/shop');
if ($shopJson) {
    $decoded = json_decode($shopJson, true);
    if ($decoded && ($decoded['ok'] || isset($decoded['vip']))) {
        $shop = $decoded;
    }
}
if (empty($shop['vip'])) {
    $shop['vip'] = [
        ['id' => 'vip1', 'name' => 'VIP I', 'level' => 1, 'price' => 149],
        ['id' => 'vip2', 'name' => 'VIP II', 'level' => 2, 'price' => 299],
        ['id' => 'vip3', 'name' => 'VIP III', 'level' => 3, 'price' => 499],
    ];
}
if (empty($shop['prefixes'])) {
    $shop['prefixes'] = [
        ['id' => 'classic', 'name' => 'Classic', 'preview' => '[VIP]', 'price' => 49],
        ['id' => 'diamond', 'name' => 'Diamond', 'preview' => '◆', 'price' => 99],
        ['id' => 'royal', 'name' => 'Royal', 'preview' => '✦', 'price' => 149],
        ['id' => 'premium', 'name' => 'Premium', 'preview' => '꧁✦꧂', 'price' => 249],
        ['id' => 'legend', 'name' => 'Legend', 'preview' => '꧁༺★༻꧂', 'price' => 399],
    ];
}
if (empty($shop['colors'])) {
    $shop['colors'] = [
        ['id' => 'blue', 'name' => 'Blue', 'hex' => '#5865F2', 'price' => 49],
        ['id' => 'cyan', 'name' => 'Cyan', 'hex' => '#00D9FF', 'price' => 99],
        ['id' => 'purple', 'name' => 'Purple', 'hex' => '#9B59FF', 'price' => 149],
        ['id' => 'gold', 'name' => 'Gold', 'hex' => '#F1C40F', 'price' => 249],
        ['id' => 'rainbow', 'name' => 'Rainbow Premium', 'hex' => '#FF4FD8', 'price' => 399],
    ];
}
if (empty($shop['cases'])) {
    $shop['cases'] = [
        ['id' => 'case_standard', 'name' => 'Стандартный кейс', 'price' => 99],
        ['id' => 'case_premium', 'name' => 'Премиум кейс', 'price' => 249],
        ['id' => 'case_legend', 'name' => 'Легендарный кейс', 'price' => 499],
    ];
}
if (empty($shop['donateAmounts'])) {
    $shop['donateAmounts'] = [50, 100, 250, 500, 1000];
}

?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Профиль – Nepegnik Interserver</title>
    <style>
        body {
            background: linear-gradient(135deg, #0f4c81, #356eaa, #1ca9ff, #0f4c81);
            background-size: 600% 600%;
            animation: gradientShift 15s ease infinite;
            color: #d0e8ff;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 40px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            text-align: center;
        }
        @keyframes gradientShift {
            0%{background-position:0% 50%}
            50%{background-position:100% 50%}
            100%{background-position:0% 50%}
        }
        .container { max-width: 1000px; width: 95%; margin: 0 auto; }
        .btn {
            display: inline-block; padding: 12px 24px; margin: 10px;
            border: 2px solid #3388ff; border-radius: 12px;
            text-decoration: none; font-weight: bold;
            box-shadow: 0 0 14px #3399ff; transition: all 0.3s;
        }
        .btn-vip { background: linear-gradient(45deg, #1a75ff, #54a0ff); color: white; }
        .btn-success { background: #4CAF50; color: white; border-color: #4CAF50; }
        .btn-danger { background: #cc2222; color: white; border-color: #cc2222; }
        .btn-warning { background: #ffaa00; color: #222; border-color: #ffaa00; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 20px #66b3ff; }
        .user-info { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px; margin: 20px 0; text-align: left; }
        .vip-section { background: rgba(255,255,255,0.15); padding: 30px; border-radius: 15px; margin: 30px 0; }
        .vip-option { background: rgba(255,255,255,0.2); padding: 20px; margin: 10px 0; border-radius: 10px; }
        .vip-active { border: 2px solid #4CAF50; box-shadow: 0 0 15px rgba(76,175,80,0.3); }
        .error-message { color: #ff4444; background: rgba(255,0,0,0.1); padding: 15px; border-radius: 10px; margin: 20px 0; }
        nav ul { list-style: none; padding: 0; margin: 0; display: flex; gap: 20px; }
        nav a { color: #aaddff; text-decoration: none; font-weight: 600; }
        nav a:hover { color: #f0f8ff; text-shadow: 0 0 8px #99ccff; }
        .admin-panel {
            background: rgba(0,0,0,0.3);
            border-radius: 15px;
            padding: 20px;
            margin: 30px 0;
            text-align: left;
        }
        .admin-panel h2 { text-align: center; color: #ffaa00; }
        .admin-tabs { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
        .admin-tab { padding: 10px 20px; background: rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer; }
        .admin-tab.active { background: #5865f2; font-weight: bold; }
        .admin-content { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; max-height: 500px; overflow-y: auto; }
        .admin-content table { width: 100%; border-collapse: collapse; color: #d0e8ff; }
        .admin-content th, .admin-content td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left; }
        .admin-content th { background: rgba(255,255,255,0.1); }
        .admin-form { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 10px 0; }
        .admin-form input, .admin-form select { padding: 8px; border-radius: 6px; border: none; flex: 1; min-width: 150px; }
        .admin-form button { padding: 8px 16px; border: none; border-radius: 6px; background: #5865f2; color: white; font-weight: bold; cursor: pointer; }
        .admin-form button:hover { background: #4752c4; }
        .log-entry { margin: 5px 0; padding: 5px; background: rgba(255,255,255,0.03); border-radius: 4px; }
        .log-time { color: #88aaff; }
        .log-actor { color: #ffdd88; }
        .log-target { color: #88ffaa; }
        .log-detail { color: #ffaa88; }
    </style>
    <link rel="stylesheet" href="assets/cart.css">
</head>
<body>
    <div class="container">
        <nav>
            <ul>
                <li><a href="index.php">Главная</a></li>
                <li><a href="profile.php">Профиль</a></li>
                <li><a href="https://discord.gg/AyHRNBbJxM">Сервер помощи</a></li>
                <li><a href="mailto:help@nepegnik.com">Почта помощи</a></li>
            </ul>
        </nav>

        <?php if ($error): ?>
            <div class="error-message"><p><?= htmlspecialchars($error) ?></p></div>
        <?php endif; ?>

        <div class="user-info">
            <h2>Профиль пользователя</h2>
            <p><strong>Имя:</strong> <?= htmlspecialchars($userName) ?></p>
            <p><strong>Discord‑тег:</strong> <?= $userDiscordTag ?></p>
            <?php if (!empty($userNicknameInServer)): ?>
                <p><strong>Ник в боте:</strong> <?= $userNicknameInServer ?></p>
            <?php endif; ?>
            <?php if (!empty($userDescription)): ?>
                <p><strong>Описание:</strong> <?= $userDescription ?></p>
            <?php endif; ?>
            <?php if ($adminLevel > 0): ?>
                <p><strong>Уровень администратора:</strong> <?= $adminLevel ?></p>
            <?php endif; ?>
        </div>

        <div class="vip-section" id="shop-section">
            <h2>Магазин</h2>

            <h3>VIP‑статус</h3>
            <?php if ($hasVIP): ?>
                <div class="vip-option vip-active">
                    <p>Статус: <span style="color: #4CAF50; font-weight: bold;">Активен</span></p>
                    <div class="btn btn-success disabled" style="opacity:0.6; cursor:default;">Уже приобретён</div>
                </div>
            <?php else: ?>
                <div class="shop-grid" style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center;">
                    <?php foreach ($shop['vip'] as $item): ?>
                        <div class="vip-option" style="flex:1; min-width:200px; max-width:280px;">
                            <h3><?= htmlspecialchars($item['name']) ?></h3>
                            <p>Цена: <?= (int)$item['price'] ?> руб.</p>
                            <p>Уровень: <?= (int)$item['level'] ?></p>
                            <button class="btn btn-vip" data-cart-add data-cart-type="vip" data-cart-id="<?= htmlspecialchars($item['id']) ?>" data-cart-name="<?= htmlspecialchars($item['name']) ?>" data-cart-price="<?= (int)$item['price'] ?>">В корзину</button>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <h3 style="margin-top:40px;">Префиксы</h3>
            <div class="shop-grid" style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center;">
                <?php foreach ($shop['prefixes'] as $item): ?>
                    <div class="vip-option" style="flex:1; min-width:200px; max-width:280px;">
                        <h3><?= htmlspecialchars($item['name']) ?></h3>
                        <p>Превью: <strong><?= htmlspecialchars($item['preview']) ?></strong></p>
                        <p>Цена: <?= (int)$item['price'] ?> руб.</p>
                        <button class="btn btn-vip" data-cart-add data-cart-type="prefix" data-cart-id="<?= htmlspecialchars($item['id']) ?>" data-cart-name="<?= htmlspecialchars($item['name']) ?>" data-cart-price="<?= (int)$item['price'] ?>">В корзину</button>
                    </div>
                <?php endforeach; ?>
            </div>

            <h3 style="margin-top:40px;">Кастомный префикс</h3>
            <div class="vip-option" style="max-width:600px; margin:0 auto;">
                <input type="text" id="customPrefix" maxlength="32" placeholder="Введите желаемый префикс" style="padding:8px; border-radius:6px; width:100%; box-sizing:border-box;" />
                <p style="font-size:0.9em; color:#aaddff; margin-top:8px;">Цена зависит от длины и спецсимволов.</p>
                <button class="btn btn-vip" data-cart-add data-cart-type="custom_prefix" data-cart-name="Кастомный префикс" data-cart-price="0" data-cart-custom-input="customPrefix" style="margin-top:10px;">В корзину</button>
            </div>

            <h3 style="margin-top:40px;">Цвета</h3>
            <div class="shop-grid" style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center;">
                <?php foreach ($shop['colors'] as $item): ?>
                    <div class="vip-option" style="flex:1; min-width:200px; max-width:280px; border-left:6px solid <?= htmlspecialchars($item['hex']) ?>;">
                        <h3 style="color:<?= htmlspecialchars($item['hex']) ?>;"><?= htmlspecialchars($item['name']) ?></h3>
                        <p>Hex: <?= htmlspecialchars($item['hex']) ?></p>
                        <p>Цена: <?= (int)$item['price'] ?> руб.</p>
                        <button class="btn btn-vip" data-cart-add data-cart-type="color" data-cart-id="<?= htmlspecialchars($item['id']) ?>" data-cart-name="<?= htmlspecialchars($item['name']) ?>" data-cart-price="<?= (int)$item['price'] ?>" data-cart-hex="<?= htmlspecialchars($item['hex']) ?>">В корзину</button>
                    </div>
                <?php endforeach; ?>
            </div>

            <h3 style="margin-top:40px;">Кейсы</h3>
            <div class="shop-grid" style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center;">
                <?php foreach ($shop['cases'] as $item): ?>
                    <div class="vip-option" style="flex:1; min-width:200px; max-width:280px;">
                        <h3><?= htmlspecialchars($item['name']) ?></h3>
                        <p>Цена: <?= (int)$item['price'] ?> руб.</p>
                        <p style="font-size:0.85em; color:#aaddff;">Случайный приз из кейса</p>
                        <button class="btn btn-vip" data-cart-add data-cart-type="case" data-cart-id="<?= htmlspecialchars($item['id']) ?>" data-cart-name="<?= htmlspecialchars($item['name']) ?>" data-cart-price="<?= (int)$item['price'] ?>">В корзину</button>
                    </div>
                <?php endforeach; ?>
            </div>

            <h3 style="margin-top:40px;">Донат</h3>
            <div class="shop-grid" style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center;">
                <?php foreach ($shop['donateAmounts'] as $amount): ?>
                    <div class="vip-option" style="flex:1; min-width:140px; max-width:160px;">
                        <h3><?= (int)$amount ?> ₽</h3>
                        <button class="btn btn-vip" data-cart-add data-cart-type="donate" data-cart-name="Донат <?= (int)$amount ?> ₽" data-cart-price="<?= (int)$amount ?>" data-cart-amount="<?= (int)$amount ?>">В корзину</button>
                    </div>
                <?php endforeach; ?>
                <div class="vip-option" style="flex:1; min-width:200px; max-width:280px;">
                    <input type="number" id="customDonate" min="1" max="1000000" placeholder="Произвольная сумма" style="padding:8px; border-radius:6px; width:100%; box-sizing:border-box;" />
                    <button class="btn btn-vip" data-cart-add data-cart-type="donate" data-cart-name="Донат" data-cart-price="0" data-cart-amount-input="customDonate" style="margin-top:10px;">В корзину</button>
                </div>
            </div>
        </div>

        <!-- Админ-панель (только для уровня >= 7) -->
        <?php if ($adminLevel >= 7): ?>
        <div class="admin-panel">
            <h2>👑 Админ-панель</h2>
            <div class="admin-tabs">
                <div class="admin-tab active" data-tab="logs">Логи</div>
                <div class="admin-tab" data-tab="bans">Баны пользователей</div>
                <div class="admin-tab" data-tab="warnings">Варны</div>
                <?php if ($adminLevel >= 7): ?>
                <div class="admin-tab" data-tab="serverbans">Бан серверов</div>
                <?php endif; ?>
            </div>

            <!-- Контент вкладок -->
            <div id="tab-logs" class="admin-content">
                <h3>Последние логи</h3>
                <div id="logsList"></div>
                <button onclick="loadLogs()" class="btn btn-blue" style="margin-top:10px;">Обновить логи</button>
            </div>

            <div id="tab-bans" class="admin-content" style="display:none;">
                <h3>Выдать бан пользователю</h3>
                <div class="admin-form">
                    <input type="text" id="banUserId" placeholder="ID пользователя (Discord ID)" />
                    <input type="text" id="banDuration" placeholder="Длительность (10m, 2h, 3d)" />
                    <input type="text" id="banReason" placeholder="Причина" />
                    <button onclick="sendAdminCommand('ban', document.getElementById('banUserId').value, document.getElementById('banDuration').value, document.getElementById('banReason').value)">Забанить</button>
                </div>
                <h4>Список активных банов</h4>
                <div id="activeBansList"></div>
            </div>

            <div id="tab-warnings" class="admin-content" style="display:none;">
                <h3>Выдать варн</h3>
                <div class="admin-form">
                    <input type="text" id="warnUserId" placeholder="ID пользователя" />
                    <input type="text" id="warnReason" placeholder="Причина" />
                    <button onclick="sendAdminCommand('warn', document.getElementById('warnUserId').value, null, document.getElementById('warnReason').value)">Выдать варн</button>
                </div>
                <h4>Последние варны</h4>
                <div id="warningsList"></div>
            </div>

            <?php if ($adminLevel >= 7): ?>
            <div id="tab-serverbans" class="admin-content" style="display:none;">
                <h3>Бан сервера</h3>
                <div class="admin-form">
                    <input type="text" id="serverBanGuildId" placeholder="ID сервера (Guild ID)" />
                    <input type="text" id="serverBanReason" placeholder="Причина" />
                    <button onclick="sendAdminCommand('serverban', document.getElementById('serverBanGuildId').value, null, document.getElementById('serverBanReason').value)">Забанить сервер</button>
                </div>
                <h4>Список забаненных серверов</h4>
                <div id="serverBansList"></div>
            </div>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        <div class="button-container">
            <a href="https://discord.com/oauth2/authorize?client_id=<?= htmlspecialchars(getenv('DISCORD_CLIENT_ID') ?: '1260881563097366548') ?>" class="btn" target="_blank">Добавить на сервер</a>
            <a href="https://discord.gg/AyHRNBbJxM" class="btn btn-danger" target="_blank">Сервер помощи</a>
        </div>
    </div>
    <?php include 'footer.php'; ?>

    <!-- JavaScript для админ-панели и WebSocket -->
    <?php if ($adminLevel >= 7): ?>
    <script>
        // Конфигурация WebSocket
        const WS_URL = '<?= htmlspecialchars(getWsUrl()) ?>?token=' + encodeURIComponent(CHAT_TOKEN);
        const USER_NAME = '<?= htmlspecialchars($userName) ?>';
        const CHAT_TOKEN = '<?= htmlspecialchars($chatToken) ?>';
        const ADMIN_LEVEL = <?= $adminLevel ?>;

        let ws;

        function connectWebSocket() {
            ws = new WebSocket(WS_URL);
            ws.onopen = function() {
                console.log('WebSocket (админ) подключён');
                // После подключения загружаем логи и списки
                loadLogs();
                loadActiveBans();
                loadWarnings();
                loadServerBans();
            };
            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'admin_result') {
                        // Результат выполнения команды
                        alert('Результат: ' + (data.message || 'Успешно'));
                        // Обновляем логи и списки
                        loadLogs();
                        loadActiveBans();
                        loadWarnings();
                        loadServerBans();
                    } else if (data.type === 'admin_error') {
                        alert('Ошибка: ' + data.message);
                    } else {
                        // Обычные сообщения чата – игнорируем в админ-панели
                    }
                } catch (e) {
                    console.error('Ошибка обработки сообщения:', e);
                }
            };
            ws.onclose = function() {
                console.log('Потеря связи, переподключение через 3 сек...');
                setTimeout(connectWebSocket, 3000);
            };
            ws.onerror = function(err) {
                console.error('WebSocket ошибка:', err);
            };
        }

        // Отправка админ-команды через WebSocket
        function sendAdminCommand(action, targetId, duration, reason) {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                alert('Нет подключения к серверу');
                return;
            }
            if (!targetId) {
                alert('Введите ID пользователя/сервера');
                return;
            }
            const command = {
                type: 'admin_command',
                action: action,
                target_id: targetId,
                duration: duration || null,
                reason: reason || 'Не указано',
                token: CHAT_TOKEN,
                admin_level: ADMIN_LEVEL
            };
            ws.send(JSON.stringify(command));
        }

        // Загрузка логов через AJAX (прямой запрос к PHP)
        function loadLogs() {
            fetch('api/get_logs.php')
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('logsList');
                    if (data.error) {
                        container.innerHTML = '<p>Ошибка: ' + data.error + '</p>';
                        return;
                    }
                    if (!data.logs || data.logs.length === 0) {
                        container.innerHTML = '<p>Логов нет</p>';
                        return;
                    }
                    let html = '';
                    data.logs.forEach(log => {
                        const detail = log.detail ? JSON.parse(log.detail) : {};
                        let detailStr = '';
                        if (detail.reason) detailStr += ' Причина: ' + detail.reason;
                        if (detail.duration) detailStr += ' Длительность: ' + detail.duration;
                        if (detail.level) detailStr += ' Уровень: ' + detail.level;
                        html += `<div class="log-entry">
                            <span class="log-time">${log.created_at}</span>
                            <span class="log-actor">${log.actor_id || 'Система'}</span>
                            → <span class="log-target">${log.target_id || '-'}</span>
                            [${log.type}] <span class="log-detail">${detailStr}</span>
                        </div>`;
                    });
                    container.innerHTML = html;
                })
                .catch(err => {
                    document.getElementById('logsList').innerHTML = '<p>Ошибка загрузки логов</p>';
                    console.error(err);
                });
        }

        // Загрузка активных банов
        function loadActiveBans() {
            fetch('api/get_bans.php')
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('activeBansList');
                    if (data.error) {
                        container.innerHTML = '<p>Ошибка: ' + data.error + '</p>';
                        return;
                    }
                    if (!data.bans || data.bans.length === 0) {
                        container.innerHTML = '<p>Активных банов нет</p>';
                        return;
                    }
                    let html = '<table><tr><th>Пользователь</th><th>Причина</th><th>Истекает</th><th>Модератор</th></tr>';
                    data.bans.forEach(ban => {
                        const expires = ban.expires_at ? new Date(Number(ban.expires_at)).toLocaleString() : 'Бессрочно';
                        html += `<tr><td>${ban.user_id}</td><td>${ban.reason || '-'}</td><td>${expires}</td><td>${ban.moderator_id || '-'}</td></tr>`;
                    });
                    html += '</table>';
                    container.innerHTML = html;
                })
                .catch(err => {
                    document.getElementById('activeBansList').innerHTML = '<p>Ошибка загрузки банов</p>';
                    console.error(err);
                });
        }

        // Загрузка последних варнов
        function loadWarnings() {
            fetch('api/get_warnings.php')
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('warningsList');
                    if (data.error) {
                        container.innerHTML = '<p>Ошибка: ' + data.error + '</p>';
                        return;
                    }
                    if (!data.warnings || data.warnings.length === 0) {
                        container.innerHTML = '<p>Варнов нет</p>';
                        return;
                    }
                    let html = '<table><tr><th>Пользователь</th><th>Причина</th><th>Дата</th><th>Модератор</th></tr>';
                    data.warnings.forEach(warn => {
                        html += `<tr><td>${warn.user_id}</td><td>${warn.reason || '-'}</td><td>${warn.created_at}</td><td>${warn.moderator_id || '-'}</td></tr>`;
                    });
                    html += '</table>';
                    container.innerHTML = html;
                })
                .catch(err => {
                    document.getElementById('warningsList').innerHTML = '<p>Ошибка загрузки варнов</p>';
                    console.error(err);
                });
        }

        // Загрузка забаненных серверов
        function loadServerBans() {
            fetch('api/get_server_bans.php')
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('serverBansList');
                    if (data.error) {
                        container.innerHTML = '<p>Ошибка: ' + data.error + '</p>';
                        return;
                    }
                    if (!data.bans || data.bans.length === 0) {
                        container.innerHTML = '<p>Забаненных серверов нет</p>';
                        return;
                    }
                    let html = '<table><tr><th>Сервер</th><th>Причина</th><th>Дата</th><th>Модератор</th></tr>';
                    data.bans.forEach(ban => {
                        html += `<tr><td>${ban.guild_id}</td><td>${ban.reason || '-'}</td><td>${ban.created_at}</td><td>${ban.moderator_id || '-'}</td></tr>`;
                    });
                    html += '</table>';
                    container.innerHTML = html;
                })
                .catch(err => {
                    document.getElementById('serverBansList').innerHTML = '<p>Ошибка загрузки банов серверов</p>';
                    console.error(err);
                });
        }

        // Переключение вкладок
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                const tabName = this.dataset.tab;
                document.querySelectorAll('.admin-content').forEach(c => c.style.display = 'none');
                document.getElementById('tab-' + tabName).style.display = 'block';
                // При переключении обновляем данные
                if (tabName === 'logs') loadLogs();
                else if (tabName === 'bans') loadActiveBans();
                else if (tabName === 'warnings') loadWarnings();
                else if (tabName === 'serverbans') loadServerBans();
            });
        });

        // Подключение WebSocket при загрузке
        window.onload = connectWebSocket;
    </script>
    <?php endif; ?>

    <script>
        window.__API_BASE__ = '<?= htmlspecialchars(getApiBase()) ?>';
        window.__CHAT_TOKEN__ = '<?= htmlspecialchars($chatToken) ?>';
    </script>
    <script src="assets/cart.js"></script>
</body>
</html>