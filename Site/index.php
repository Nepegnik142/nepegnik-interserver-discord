<?php
session_start();
require_once __DIR__ . '/db/db.php';

$pdo = getDbConnection();

$isLoggedIn = isset($_SESSION['user_logged_in']) && $_SESSION['user_logged_in'] === true;
$userId = $_SESSION['user_id'] ?? null;
$userName = $isLoggedIn ? ($_SESSION['discord_user']['username'] ?? 'Пользователь') : '';

// Генерация токена для авторизации запросов (если авторизован)
if ($isLoggedIn && $userId && empty($_SESSION['chat_token'])) {
    $_SESSION['chat_token'] = bin2hex(random_bytes(32));
    try {
        $stmt = $pdo->prepare("INSERT INTO user_tokens (user_id, token) VALUES (?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token)");
        $stmt->execute([$userId, $_SESSION['chat_token']]);
    } catch (PDOException $e) {
        error_log("Token save error: " . $e->getMessage());
    }
}
$chatToken = $_SESSION['chat_token'] ?? null;

// Конфиг Discord OAuth
$config = [
    'client_id' => getenv('DISCORD_CLIENT_ID') ?: '',
    'redirect_uri' => getenv('DISCORD_REDIRECT_URI') ?: 'https://ваш-бот.да-я-скрыл-url-адресс/discord_callback.php',
    'scope' => 'identify+email'
];
$discord_auth_url = "https://discord.com/api/oauth2/authorize?client_id={$config['client_id']}&redirect_uri=" . urlencode($config['redirect_uri']) . "&response_type=code&scope={$config['scope']}";
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="yandex-verification" content="21f959d9010355aa" />
    <title>Nepegnik Interserver</title>
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
        h1 { font-size: 3em; margin-bottom: 0.3em; text-shadow: 0 0 12px #66b3ff; }
        .container { max-width: 800px; width: 90%; margin: 0 auto; }
        .btn {
            display: inline-block; padding: 12px 24px; margin: 10px;
            border: 2px solid #3388ff; border-radius: 12px;
            text-decoration: none; font-weight: bold;
            box-shadow: 0 0 14px #3399ff; transition: all 0.3s;
        }
        .btn-blue { background-color: #1a75ff; color: white; }
        .btn-red { background-color: #cc2222; color: white; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 20px #66b3ff; }
        .button-container { margin: 30px 0; display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
        nav ul { list-style: none; padding: 0; margin: 0; display: flex; gap: 20px; }
        nav a { color: #aaddff; text-decoration: none; font-weight: 600; }
        nav a:hover { color: #f0f8ff; text-shadow: 0 0 8px #99ccff; }
        #chatBox { height:300px; overflow-y:auto; background:rgba(0,0,0,0.2); border-radius:8px; padding:10px; margin-bottom:10px; text-align:left; }
        .chat-input-area { display:flex; gap:10px; flex-wrap:wrap; }
        .chat-input-area input, .chat-input-area button { padding:8px 12px; border-radius:6px; border:none; }
        .chat-input-area input { flex:1; min-width:120px; }
        .chat-input-area button { background:#5865f2; color:white; font-weight:bold; cursor:pointer; }
        .section { margin: 30px 0; }
        .section ul { list-style: none; padding: 0; }
        .section li { margin: 8px 0; }
        .message-owner { color: #FFD700; font-weight: bold; }
        .message-rainbow {
            background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: bold;
            text-shadow: 0 0 10px #ff0000, 0 0 20px #ff7f00, 0 0 30px #ffff00, 0 0 40px #00ff00, 0 0 50px #0000ff, 0 0 60px #4b0082, 0 0 70px #8b00ff;
        }
    </style>
</head>
<body>
    <div class="container">
        <nav>
            <ul>
                <li><a href="index.php">Главная</a></li>
                <?php if ($isLoggedIn): ?>
                    <li><a href="profile.php">Профиль (Временно закрыт. Обновления)</a></li>
                <?php endif; ?>
                <li><a href="https://discord.gg/AyHRNBbJxM">Сервер помощи</a></li>
                <li><a href="mailto:почта">Почта помощи</a></li>
            </ul>
        </nav>

        <h1>Nepegnik Interserver</h1>
        <p>Общайтесь между серверами Discord в реальном времени</p>

<!-- Блок чата -->
<div class="chat">
    <h3>Межсерверный чат</h3>

    <?php if ($isLoggedIn): ?>
        <div id="chatBox" class="chat-box" aria-live="polite"></div>

        <form class="chat-input-area" onsubmit="sendChatMessage(); return false;">
            <input
                type="text"
                id="msgInput"
                placeholder="Введите сообщение..."
                autocomplete="off"
                maxlength="1000"
                required
            />
            <button type="submit">Отправить</button>
        </form>
    <?php else: ?>
        <p>
            Для участия в чате
            <a href="<?= htmlspecialchars($discord_auth_url, ENT_QUOTES, 'UTF-8') ?>"
               class="btn btn-blue">войдите через Discord</a>
        </p>
    <?php endif; ?>
</div>

<style>
.chat {
    margin: 30px 0;
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
}

.chat-box {
    height: 300px;
    overflow-y: auto;
    margin-bottom: 12px;
}

.chat-input-area {
    display: flex;
    gap: 8px;
}

.chat-input-area input {
    flex: 1;
    min-width: 0;
}
</style>
        <!-- Плюсы и минусы -->
        <section class="section">
            <h2>Плюсы нашего бота</h2>
            <ul>
                <li>🤖 Автоматизация рутинных задач</li>
                <li>⚡️ Быстрая и надёжная работа</li>
                <li>🔒 Высокая безопасность и защита данных</li>
                <li>🔧 Лёгкость в настройке и управлении</li>
                <li>🌐 Поддержка нескольких серверов и функций</li>
                <li>💬 Разработчик активно общается с комьюнити</li>
            </ul>
        </section>
        <section class="section">
            <h2>Минусы нашего бота</h2>
            <ul>
                <li>🛠 Иногда требуется тонкая настройка для сложных кейсов</li>
                <li>⏳ Возможно небольшое время отклика при высокой нагрузке</li>
                <li>📚 Для новичков некоторые функции могут показаться сложными</li>
                <li>🔄 Регулярные обновления требуют внимательного отслеживания</li>
            </ul>
        </section>
    </div>
    <?php include 'footer.php'; ?>

    <?php if ($isLoggedIn && $chatToken): ?>
    <script>
        const USER_NAME = '<?= htmlspecialchars($userName) ?>';
        const CHAT_TOKEN = '<?= htmlspecialchars($chatToken) ?>';
        let lastMessageId = 0; // ID последнего полученного сообщения
        const chatBox = document.getElementById('chatBox');

        // Загрузка последних 50 сообщений при старте
        function loadInitialMessages() {
            fetch('api/get_message.php?limit=50')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.messages.length) {
                        // Очищаем чат и заполняем
                        chatBox.innerHTML = '';
                        data.messages.forEach(msg => appendMessage(msg));
                        // Обновляем lastMessageId
                        if (data.messages.length > 0) {
                            lastMessageId = data.messages[data.messages.length - 1].id;
                        }
                    }
                })
                .catch(err => console.error('Ошибка загрузки начальных сообщений:', err));
        }

        // Добавление одного сообщения в чат
        function appendMessage(msg) {
            const div = document.createElement('div');
            div.style.marginBottom = '5px';

            let authorDisplay = msg.author;
            let textDisplay = msg.text;
            let guildDisplay = msg.guild ? `[${msg.guild}]` : '[Сайт]';

            // Специальная обработка для OWNER и радужного текста (если нужно)
            // Можно добавить проверку на тип, но в простом варианте выводим как есть
            // Для демонстрации добавим классы по желанию
            const isOwner = (msg.author === 'OWNER');
            const isRainbow = (msg.text && msg.text.startsWith('/rainbow')); // или по другому признаку

            if (isOwner) {
                div.innerHTML = `<strong>${guildDisplay} 👑 OWNER:</strong> ${textDisplay}`;
                div.style.color = '#FFD700';
                div.style.fontWeight = 'bold';
            } else if (isRainbow) {
                const prefix = document.createElement('span');
                prefix.innerHTML = `<strong>${guildDisplay} ${authorDisplay}:</strong> `;
                div.appendChild(prefix);
                const rainbowSpan = document.createElement('span');
                rainbowSpan.textContent = textDisplay.replace('/rainbow', '').trim();
                rainbowSpan.className = 'message-rainbow';
                div.appendChild(rainbowSpan);
            } else {
                div.innerHTML = `<strong>${guildDisplay} ${authorDisplay}:</strong> ${textDisplay}`;
            }

            chatBox.appendChild(div);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        // Опрос новых сообщений (каждые 5 мс)
        function pollNewMessages() {
            fetch(`api/get_message.php?last_id=${lastMessageId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.messages.length) {
                        data.messages.forEach(msg => {
                            appendMessage(msg);
                            if (msg.id > lastMessageId) lastMessageId = msg.id;
                        });
                    }
                })
                .catch(err => console.error('Ошибка опроса:', err));
        }

        // Отправка нового сообщения
        function sendChatMessage() {
            const input = document.getElementById('msgInput');
            const text = input.value.trim();
            if (!text) return;

            fetch('api/send_message.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    author: USER_NAME,
                    token: CHAT_TOKEN
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    input.value = '';
                    // Можно сразу добавить своё сообщение в чат (опционально)
                    // но оно придёт через polling, поэтому ничего не делаем
                } else {
                    alert('Ошибка отправки: ' + (data.error || 'неизвестная ошибка'));
                }
            })
            .catch(err => {
                console.error('Ошибка отправки:', err);
                alert('Не удалось отправить сообщение');
            });
        }

        // Инициализация при загрузке
        window.onload = function() {
            loadInitialMessages();
            // Запускаем опрос с интервалом 1 с
            setInterval(pollNewMessages, 1000);
            // Обработчик Enter
            const input = document.getElementById('msgInput');
            if (input) {
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') sendChatMessage();
                });
            }
        };
    </script>
    <?php endif; ?>

    <script>
        window.__API_BASE__ = '<?= htmlspecialchars(getApiBase()) ?>';
        window.__CHAT_TOKEN__ = '<?= htmlspecialchars($chatToken ?? '') ?>';
    </script>
</body>
</html>