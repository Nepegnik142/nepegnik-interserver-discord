<?php
require_once __DIR__ . '/db/db.php';
$pdo = getDbConnection();
$outSum = $_POST['OutSum'] ?? ($_GET['order_id'] ? '—' : '0.00');
$invId = $_POST['InvId'] ?? ($_GET['order_id'] ?? 'Не указан');
$userName = $_POST['UserName'] ?? 'Уважаемый клиент';
$errorCode = $_POST['ErrorCode'] ?? 'N/A';
$errorMessage = $_POST['ErrorMessage'] ?? 'Ошибка не описана';

if ($_GET['order_id'] ?? '') {
    try {
        $stmt = $pdo->prepare("SELECT * FROM payments WHERE invoice_id = ? LIMIT 1");
        $stmt->execute([$_GET['order_id']]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($payment) {
            $outSum = $payment['sum'];
            $invId = $payment['invoice_id'];
            $errorMessage = 'Платёж отменён или не завершён';
        }
    } catch (Exception $e) {
        error_log('fail.php DB error: ' . $e->getMessage());
    }
}

// Логируем ошибку (опционально)
$logMessage = sprintf(
    "[%s] Payment FAILED: Order #%s, Amount: %s RUB, Error: %s (%s)\n",
    date('Y-m-d H:i:s'),
    $invId,
    $outSum,
    $errorCode,
    $errorMessage
);
file_put_contents('robokassa_errors.log', $logMessage, FILE_APPEND | LOCK_EX);
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Ошибка оплаты</title>
    <style>
        body {
            background: linear-gradient(135deg, #8b0000, #b22222, #dc143c, #8b0000);
            background-size: 600% 600%;
            animation: gradientShift 15s ease infinite;
            color: #ffe6e6;
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
        h1 {
            font-size: 3em;
            margin-bottom: 0.3em;
            text-shadow: 0 0 12px #ff6b6b;
        }
        .container {
            max-width: 800px;
            width: 90%;
            margin: 0 auto;
        }
        .error-info {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            text-align: left;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 10px;
            border: 2px solid #ff6b6b;
            border-radius: 12px;
            text-decoration: none;
            font-weight: bold;
            box-shadow: 0 0 14px #ff4757;
            transition: all 0.3s;
            color: white;
        }
        .btn-red {
            background-color: #dc143c;
        }
        .btn-yellow {
            background-color: #ffa500;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px #ff6b6b;
        }
        .button-container {
            margin: 30px 0;
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .troubleshooting {
            background: rgba(255, 255, 255, 0.15);
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
        }
        .tip {
            background: rgba(255, 255, 255, 0.2);
            padding: 15px;
            margin: 10px 0;
            border-radius: 10px;
            border-left: 4px solid #ffa500;
        }
        ul {
            text-align: left;
            max-width: 600px;
            margin: 0 auto 40px auto;
            padding: 0 20px;
        }
        li {
            margin-bottom: 10px;
            font-size: 1.1em;
        }
        p {
            font-size: 1.2em;
            margin-bottom: 1.5em;
        }
        nav ul {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            gap: 20px;
            font-family: Arial, sans-serif;
        }
        nav ul li {
            display: inline;
        }
        nav a {
            color: #ffd7d7;
            text-decoration: none;
            font-weight: 600;
        }
        nav a:hover {
            color: #fff;
            text-shadow: 0 0 8px #ff6b6b;
        }
        .error-code {
            background: rgba(255, 0, 0, 0.3);
            padding: 10px;
            border-radius: 8px;
            font-family: monospace;
            display: inline-block;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Ошибка оплаты</h1>

        <nav>
            <ul>
                <li><a href="/">Главная</a></li>
                <li><a href="/profile">Мой профиль</a></li>
                <li><a href="/support">Поддержка</a></li>
            </ul>
        </nav>

        <div class="error-info">
            <p>Здравствуйте, <strong><?= htmlspecialchars($userName) ?></strong>!</p>
            <p>К сожалению, платёж на сумму <strong><?= $outSum ?> руб.</strong> не был обработан.</p>
            <p>Номер заказа: <strong>#<?= $invId ?></strong></p>

            <div class="error-code">
                Код ошибки: <?= htmlspecialchars($errorCode) ?> — <?= htmlspecialchars($errorMessage) ?>
            </div>
        </div>

        <p>Пожалуйста, попробуйте ещё раз или выберите другой способ оплаты.</p>

        <div class="troubleshooting">
            <h2>🔧 Рекомендации по устранению</h2>
            <div class="tip">
                <p><strong>Проверьте:</strong></p>
                <ul>
                    <li>Достаточно ли средств на карте</li>
            <li>Правильно ли введены данные карты</li>
            <li>Не истёк ли срок действия карты</li>
            <li>Подключена ли функция 3D‑Secure (подтверждение по SMS)</li>
            <li>Нет ли ограничений от банка</li>
        </ul>
            </div>
            <div class="tip">
                <p>Если проблема сохраняется, свяжитесь с поддержкой: <a href="https://discord.gg/AyHRNBbJxM">https://discord.gg/AyHRNBbJxM</a></p>
            </div>
        </div>

        <?php include 'footer.php'; ?>
    </div>
</body>
</html>