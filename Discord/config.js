const crypto = require('crypto');

const CONFIG = {
  TEST_API_KEY: process.env.API_KEY || 'API_KEY_REPLACE_ME',
  TOKEN: process.env.DISCORD_TOKEN || 'TEST_DISCORD_TOKEN_REPLACE_ME',
  CLIENT_ID: process.env.CLIENT_ID || '000000000000000000',
  ADMIN_IDS: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(s => s.trim()).filter(Boolean) : [],
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  PUNISHMENT_WEBHOOK_URL: process.env.PUNISHMENT_WEBHOOK_URL || process.env.WEBHOOK_URL || '',
  PUNISHMENT_DM_NOTIFICATIONS: String(process.env.PUNISHMENT_DM_NOTIFICATIONS || 'true').toLowerCase() === 'true',
  APPEAL_URL: process.env.APPEAL_URL || 'Аппеляция',
  SERVER_INVITE_URL: process.env.SERVER_INVITE_URL || process.env.APPEAL_URL || '',
  API_KEY: process.env.API_KEY || TEST_API_KEY,
  PORT: Number(process.env.PORT || порт),
  SITE_API_URL: String(process.env.SITE_API_URL || '').replace(/\/$/, ''),
  SITE_API_KEY: process.env.SITE_API_KEY || TEST_API_KEY,
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_USER: process.env.DB_USER || 'interserver_test',
  DB_PASSWORD: process.env.DB_PASSWORD || 'TEST_DB_PASSWORD',
  DB_NAME: process.env.DB_NAME || 'interserver_test',
  ROBOKASSA_LOGIN: process.env.ROBOKASSA_LOGIN || 'TEST_MERCHANT',
  ROBOKASSA_PASSWORD1: process.env.ROBOKASSA_PASSWORD1 || 'TEST_PASSWORD_1',
  ROBOKASSA_PASSWORD2: process.env.ROBOKASSA_PASSWORD2 || 'TEST_PASSWORD_2',
  ROBOKASSA_VIP_SUM: Number(process.env.ROBOKASSA_VIP_SUM || 49),
  VOICE_ENABLED: String(process.env.VOICE_ENABLED || 'true').toLowerCase() === 'true',
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || '2328',
  PUBLIC_URL: process.env.PUBLIC_URL || '',
  PAYMENT_2328_BASE_URL: process.env.PAYMENT_2328_BASE_URL || 'https://api.2328.io/api',
  PAYMENT_2328_PROJECT_UUID: process.env.PAYMENT_2328_PROJECT_UUID || '00000000-0000-0000-0000-000000000000',
  PAYMENT_2328_API_KEY: process.env.PAYMENT_2328_API_KEY || 'TEST_2328_API_KEY_REPLACE_ME',
  PAYMENT_2328_CURRENCY: process.env.PAYMENT_2328_CURRENCY || 'RUB',
  PAYMENT_2328_TO_CURRENCY: process.env.PAYMENT_2328_TO_CURRENCY || '',
  PAYMENT_2328_NETWORK: process.env.PAYMENT_2328_NETWORK || '',
  PAYMENT_2328_CALLBACK_URL: process.env.PAYMENT_2328_CALLBACK_URL || '',
  PAYMENT_2328_RETURN_URL: process.env.PAYMENT_2328_RETURN_URL || '',
  PAYMENT_2328_TTL: Number(process.env.PAYMENT_2328_TTL || 3600),
  PAYMENT_2328_USER_AGENT: process.env.PAYMENT_2328_USER_AGENT || 'Nepegnik-InterServer/3.3 (+https://nepegnik.com/)',
};

const LOCALES = {
  ru: {
    no_permission: 'У вас нет доступа к этой команде.',
    channel_set: 'Текстовый межсерверный канал сохранён.',
    channel_deleted: 'Текстовый межсерверный канал удалён.',
    voice_set: 'Межсерверный голосовой канал подключён.',
    voice_deleted: 'Межсерверный голосовой канал отключён.',
    vip_assigned: 'VIP назначен.',
    vip_removed: 'VIP снят.',
    user_banned: 'Пользователь забанен.',
    user_unbanned: 'Бан снят.',
    server_banned: 'Сервер заблокирован.',
    server_unbanned: 'Блокировка сервера снята.',
    error_generic: 'Произошла ошибка, проверьте логи.',
  },
  en: {
    no_permission: 'You do not have access to this command.',
    channel_set: 'Inter-server text channel saved.',
    channel_deleted: 'Inter-server text channel removed.',
    voice_set: 'Inter-server voice channel connected.',
    voice_deleted: 'Inter-server voice channel disconnected.',
    vip_assigned: 'VIP assigned.',
    vip_removed: 'VIP removed.',
    user_banned: 'User has been banned.',
    user_unbanned: 'Ban removed.',
    server_banned: 'Server is banned.',
    server_unbanned: 'Server ban removed.',
    error_generic: 'An error occurred; check the logs.',
  },
};

const COMMAND_LOCALES = {};
const OPTION_LOCALES = {};

function localeCode(locale) {
  const code = String(locale || 'ru').toLowerCase().split('-')[0];
  return code === 'en' ? 'en' : 'ru';
}
function t(locale, key) {
  const code = localeCode(locale);
  return LOCALES[code]?.[key] || LOCALES.ru[key] || key;
}
function commandLocale(interaction) {
  return localeCode(interaction.locale || interaction.user?.locale || 'ru');
}
function generateApiKey() {
  return `INTERSERVER-${crypto.randomBytes(24).toString('hex')}`;
}
module.exports = { CONFIG, LOCALES, COMMAND_LOCALES, OPTION_LOCALES, localeCode, t, commandLocale, generateApiKey };
