<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Политика конфиденциальности — NEPEGNIK INTERSERVER</title>
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
        h1, h2 {
            font-size: 3em;
            margin-bottom: 0.3em;
            text-shadow: 0 0 12px #66b3ff;
        }
        h2 {
            font-size: 2em;
            margin-top: 1.5em;
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
        <h1>Политика конфиденциальности</h1>
        <h2>1. Общие положения</h2>
        <p>Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки персональных данных пользователей (далее — «Пользователь») при использовании Discord‑бота [Название бота] (далее — «Бот»).</p>
        <p>Используя Бот, Пользователь подтверждает своё согласие с условиями настоящей Политики.</p>

        <h2>2. Какие данные мы собираем</h2>
        <ul>
            <li>ID пользователя Discord;</li>
            <li>Имя пользователя Discord;</li>
            <li>Теги сервера;</li>
            <li>Сообщения, адресованные Боту;</li>
            <li>Данные о взаимодействии с командами Бота.</li>
        </ul>

        <h2>3. Цели обработки данных</h2>
        <ul>
            <li>Предоставление функциональных возможностей Бота;</li>
            <li>Техническая поддержка и устранение неполадок;</li>
            <li>Анализ использования функционала для его улучшения;</li>
            <li>Коммуникация с Пользователем (при необходимости).</li>
        </ul>

        <h2>4. Защита данных</h2>
        <p>Мы принимаем технические и организационные меры для защиты данных от несанкционированного доступа, уничтожения, изменения, блокирования, копирования и распространения.</p>

        <h2>5. Передача данных третьим лицам</h2>
        <p>Персональные данные Пользователя не передаются третьим лицам, за исключением случаев, предусмотренных законодательством РФ/США/Республики Беларусь/Республики Казахстан.</p>

        <h2>6. Права пользователя</h2>
        <ul>
            <li>Запросить информацию о своих данных;</li>
            <li>Потребовать исправления неточных данных;</li>
            <li>Потребовать удаления своих данных из базы (отказаться от услуг Бота).</li>
        </ul>

        <h2>7. Изменения в Политике</h2>
        <p>Мы оставляем за собой право вносить изменения в Политику. Новая редакция публикуется на этой странице с указанием даты последнего обновления.</p>

        <h2>8. Контакты</h2>
        <p>По вопросам, связанным с обработкой персональных данных, обращайтесь по адресу: <a href="mailto:почта">почта</a>.</p>

        <p><em>Дата последнего обновления: <?= date('d.m.Y') ?></em></p>
    </div>
	<?php include 'footer.php'; ?>
</body>
</html>
