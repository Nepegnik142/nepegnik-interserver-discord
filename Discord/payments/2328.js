const crypto = require('crypto');
const { CONFIG } = require('../config');

function signBody(body, apiKey = CONFIG.PAYMENT_2328_API_KEY) {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  const base64 = Buffer.from(json, 'utf8').toString('base64');
  return crypto.createHmac('sha256', apiKey).update(base64).digest('hex');
}

function verifyWebhook(payload, apiKey = CONFIG.PAYMENT_2328_API_KEY) {
  if (!payload || !payload.sign) return false;
  const { sign, ...rest } = payload;
  const calculated = signBody(rest, apiKey);
  const a = Buffer.from(calculated, 'utf8');
  const b = Buffer.from(String(sign), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getCallbackUrl() {
  const raw = String(
    CONFIG.PAYMENT_2328_CALLBACK_URL ||
    `${String(CONFIG.PUBLIC_URL || '').replace(/\/$/, '')}/webhooks/2328`
  ).trim().replace(/^['"]|['"]$/g, '');

  if (!raw) {
    throw new Error('2328.io: не задан URL callback. Укажите PAYMENT_2328_CALLBACK_URL=https://ваш-домен/webhooks/2328');
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`2328.io: некорректный PAYMENT_2328_CALLBACK_URL: ${raw}`);
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error(`2328.io: PAYMENT_2328_CALLBACK_URL должен быть абсолютным URL, например https://example.com/webhooks/2328. Получено: ${raw}`);
  }

  // 2328 должен иметь возможность обратиться к webhook извне.
  // Локальные адреса оставляем допустимыми для тестовой конфигурации только
  // на уровне валидации URL, но реальная оплата с ними не будет подтверждаться.
  return url.toString();
}

async function apiPost(path, data) {
  if (!CONFIG.PAYMENT_2328_PROJECT_UUID || !CONFIG.PAYMENT_2328_API_KEY) {
    throw new Error('2328.io не настроен: укажите PAYMENT_2328_PROJECT_UUID и PAYMENT_2328_API_KEY');
  }

  const body = JSON.stringify(data);
  const response = await fetch(`${CONFIG.PAYMENT_2328_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': CONFIG.PAYMENT_2328_USER_AGENT,
      project: CONFIG.PAYMENT_2328_PROJECT_UUID,
      sign: signBody(body),
    },
    body,
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`2328.io вернул не JSON (HTTP ${response.status}): ${text.slice(0, 500)}`);
  }

  if (!response.ok || json.state !== 0) {
    throw new Error(`2328.io API error: HTTP ${response.status}, state=${json.state ?? 'unknown'}, ${JSON.stringify(json)}`);
  }

  return json.result;
}

async function createPayment({ invoiceId, amount, description }) {
  const data = {
    // 2328 рекомендует передавать денежные значения строками.
    amount: Number(amount).toFixed(2),
    currency: CONFIG.PAYMENT_2328_CURRENCY,
    order_id: String(invoiceId),
    url_callback: getCallbackUrl(),
    description: String(description || 'Покупка в InterServer').slice(0, 200),
    ttl_seconds: CONFIG.PAYMENT_2328_TTL,
  };

  if (CONFIG.PAYMENT_2328_TO_CURRENCY) data.to_currency = CONFIG.PAYMENT_2328_TO_CURRENCY;
  if (CONFIG.PAYMENT_2328_NETWORK) data.network = CONFIG.PAYMENT_2328_NETWORK;
  if (CONFIG.PAYMENT_2328_RETURN_URL) data.url_return = CONFIG.PAYMENT_2328_RETURN_URL;

  return apiPost('/v1/payment', data);
}

module.exports = { createPayment, verifyWebhook, signBody, apiPost, getCallbackUrl };
