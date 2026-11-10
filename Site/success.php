<?php
require_once __DIR__ . '/db/db.php';
$pdo = getDbConnection();
$orderId = $_GET['order_id'] ?? ($_POST['InvId'] ?? '');
$payment = null;
if ($orderId) {
    try {
        $stmt = $pdo->prepare("SELECT * FROM payments WHERE invoice_id = ? LIMIT 1");
        $stmt->execute([$orderId]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log('success.php DB error: ' . $e->getMessage());
    }
}
$amount = $payment ? ($payment['sum'] . ' руб.') : '—';
$status = $payment ? ($payment['status'] === 'success' || $payment['status'] === 'paid' ? 'Успешно' : htmlspecialchars($payment['status'])) : 'Успешно';
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Оплата успешна!</title>
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
        h1 {
            font-size: 3em;
            margin-bottom: 0.3em;
            text-shadow: 0 0 12px #66b3ff;
        }
        .container {
            max-width: 800px;
            width: 90%;
            margin: 0 auto;
        }
        .user-info {
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
            border: 2px solid #3388ff;
            border-radius: 12px;
            text-decoration: none;
            font-weight: bold;
            box-shadow: 0 0 14px #3399ff;
            transition: all 0.3s;
        }
        .btn-blue {
            background-color: #1a75ff;
            color: white;
        }
        .btn-red {
            background-color: #cc2222;
            color: white;
        }
        .btn-vip {
            background: linear-gradient(45deg, #1a75ff, #54a0ff);
            color: white;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px #66b3ff;
        }
        .button-container {
            margin: 30px 0;
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .vip-section {
            background: rgba(255, 255, 255, 0.15);
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
        }
        .vip-option {
            background: rgba(255, 255, 255, 0.2);
            padding: 20px;
            margin: 10px 0;
            border-radius: 10px;
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
            color: #aaddff;
            text-decoration: none;
            font-weight: 600;
        }
        nav a:hover {
            color: #f0f8ff;
            text-shadow: 0 0 8px #99ccff;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ Оплата прошла успешно!</h1>

        <nav>
            <ul>
                <li><a href="/">Главная</a></li>
            </ul>
        </nav>

        <div class="user-info">
            <p>Здравствуйте, <strong>уважаемый пользователь</strong>!</p>
            <p>Ваш платёж на сумму <strong><?= $amount ?></strong> обработан.</p>
            <p>Номер заказа: <strong>#<?= htmlspecialchars($orderId) ?: '—' ?></strong></p>
            <p>Статус оплаты: <strong><?= $status ?></strong></p>
        </div>

        <p>Благодарим за покупку! Доступ к VIP откроется в ближайшее время.</p>

        <div class="vip-section">
            <h2>🎁 Бонусы для VIP‑клиентов</h2>
            <div class="vip-option">
                <p>Оформите VIP‑статус и получите:</p>
                <ul>
                    <li>.rainbow</li>
                    <li>14 изменений ника</li>
                    <li>14 изменений описания</li>
                    <li>Ссылка приглашения на сервер с которого вы написали</li>
                </ul>
            </div>
        </div>
	<?php include 'footer.php'; ?>
    </div>
</body>
</html>
