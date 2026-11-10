const { CONFIG } = require('./config');

function getPaymentProvider(name = CONFIG.PAYMENT_PROVIDER) {
  const provider = String(name || '2328').toLowerCase();
  if (provider === '2328') return require('./payments/2328');
  if (provider === 'robokassa') return require('./payments/robokassa');
  throw new Error(`Неизвестный платёжный провайдер: ${provider}`);
}

async function createCheckout({ userId, targetUserId, type, amount, metadata = {}, description, invoiceId }) {
  const provider = getPaymentProvider();
  if (typeof provider.createPayment !== 'function') {
    throw new Error(`Провайдер ${CONFIG.PAYMENT_PROVIDER} не поддерживает создание платежей`);
  }
  return provider.createPayment({ userId, targetUserId, type, amount, metadata, description, invoiceId });
}

async function verifyWebhook(providerName, payload) {
  const provider = getPaymentProvider(providerName);
  if (typeof provider.verifyWebhook !== 'function') return false;
  return provider.verifyWebhook(payload);
}

module.exports = { getPaymentProvider, createCheckout, verifyWebhook };
