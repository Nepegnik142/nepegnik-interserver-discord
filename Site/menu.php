<?php
session_start();
require_once __DIR__ . '/db/db.php';

$client_id = getenv('DISCORD_CLIENT_ID') ?: 'Замените';
$redirect_uri = urlencode(getenv('DISCORD_REDIRECT_URI') ?: 'https://замените/discord_callback.php');
$scope = 'identify+email';

$discord_auth_url = "https://discord.com/api/oauth2/authorize" .
    "?client_id={$client_id}" .
    "&redirect_uri={$redirect_uri}" .
    "&response_type=code" .
    "&scope={$scope}";

$isLoggedIn = isset($_SESSION['user_logged_in']) && $_SESSION['user_logged_in'] === true;
$paymentUrls = [];
?>

<nav>
  <ul>
    <li><a href="index.php">Главная</a></li>
    <li><a href="features.php">Возможности</a></li>
    <li><a href="support.php">Сервер помощи</a></li>
    <?php if ($isLoggedIn): ?>
        <li><a href="profile.php">Профиль</a></li>
    <?php else: ?>
        <li><a href="<?= $discord_auth_url ?>">Войти</a></li>
    <?php endif; ?>
  </ul>
</nav>

<style>
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
<div id="vip-payment-link" style="margin-top:20px;"></div>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    const vipButtons = document.querySelectorAll('#vip-buttons .btn-vip');
    const vipInfo = document.getElementById('vip-selected-info');
    const paymentLinkDiv = document.getElementById('vip-payment-link');

    const paymentUrls = <?= json_encode($paymentUrls, JSON_UNESCAPED_UNICODE); ?>;

    vipButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const key = btn.getAttribute('data-key');
        const label = btn.getAttribute('data-label');
        const price = btn.getAttribute('data-price');

        vipInfo.textContent = `Сейчас выбран VIP: «${label}» — стоимость: ${price} ₽`;
        vipInfo.style.display = 'block';

        if(paymentUrls[key]) {
          paymentLinkDiv.innerHTML = `<a href="${paymentUrls[key]}" target="_blank" class="btn-vip">Перейти к оплате</a>`;
        } else {
          paymentLinkDiv.innerHTML = '';
        }
      });
    });
  });
</script>

</body>
</html>
