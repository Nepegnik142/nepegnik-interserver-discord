const mysql = require('mysql2/promise');
let pool = null;

async function initDatabase() {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10
  });
  const conn = await pool.getConnection();
  await conn.ping();
  await conn.query(`CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    type VARCHAR(64) NOT NULL,
    sum DECIMAL(12,2) NOT NULL,
    target_user_id VARCHAR(32) NULL,
    metadata JSON NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'pending',
    provider VARCHAR(32) NULL,
    provider_payment_id VARCHAR(128) NULL,
    payment_url TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payments_user (user_id),
    INDEX idx_payments_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  conn.release();
  return pool;
}

function getPool() {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

// ---- Админы ----
async function isAdmin(userId) {
  const [rows] = await getPool().query('SELECT level FROM admins WHERE user_id=? LIMIT 1', [userId]);
  return rows.length > 0 ? rows[0].level : 0;
}

// ---- Баны серверов и пользователей ----
async function isGuildBanned(id) {
  const [rows] = await getPool().query('SELECT * FROM server_bans WHERE guild_id=? AND active=1 LIMIT 1', [id]);
  return rows[0] || null;
}

async function isUserBanned(id) {
  const [rows] = await getPool().query('SELECT * FROM bans WHERE user_id=? AND active=1 LIMIT 1', [id]);
  const ban = rows[0] || null;
  if (!ban) return null;

  if (ban.expires_at != null) {
    const raw = Number(ban.expires_at);
    // ms ~ 1.7e12, s ~ 1.7e9: если меньше 1e12 — считаем секундами
    const expiresMs = raw < 1e12 ? raw * 1000 : raw;
    if (expiresMs <= Date.now()) {
      await unbanUser(id);
      return null;
    }
  }
  return ban;
}

function parseExpireTime(value) {
  if (value == null || value === '' || String(value).toLowerCase() === 'never') return null;
  const match = String(value).trim().match(/^(\d+)(m|h|d|w)$/i);
  if (!match) throw new Error('Срок: 30m, 2h, 7d, 1w или never');
  const d = new Date();
  const num = +match[1];
  const unit = match[2].toLowerCase();
  if (unit === 'm') d.setMinutes(d.getMinutes() + num);
  else if (unit === 'h') d.setHours(d.getHours() + num);
  else if (unit === 'd') d.setDate(d.getDate() + num);
  else if (unit === 'w') d.setDate(d.getDate() + num * 7);
  return d;
}

async function banUser(userId, moderatorId, duration, reason) {
  const why = String(reason || 'Не указана').trim() || 'Не указана';
  const expiresDate = parseExpireTime(duration);
  // expires_at в БД — bigint(20), кладём миллисекунды (или NULL для "never")
  const expires = expiresDate ? expiresDate.getTime() : null;

  await getPool().query(
    `INSERT INTO bans (user_id, reason, expires_at, active, moderator_id)
     VALUES (?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE reason=VALUES(reason), expires_at=VALUES(expires_at), active=1, moderator_id=VALUES(moderator_id)`,
    [userId, why, expires, moderatorId]
  );
  return true;
}

async function unbanUser(userId) {
  await getPool().query('DELETE FROM bans WHERE user_id=?', [userId]);
  return true;
}

async function banGuild(guildId, moderatorId, reason) {
  await getPool().query(
    'INSERT INTO server_bans (guild_id, reason, active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE reason=VALUES(reason), active=1',
    [guildId, reason]
  );
  return true;
}

async function unbanGuild(guildId) {
  await getPool().query('DELETE FROM server_bans WHERE guild_id=?', [guildId]);
  return true;
}

// ---- VIP ----
async function isVip(userId) {
  const [rows] = await getPool().query('SELECT * FROM vip WHERE user_id=? LIMIT 1', [userId]);
  return rows.length > 0;
}

async function setVip(userId, level = 1, moderatorId = null) {
  await getPool().query(
    'INSERT INTO vip (user_id, level, purchased_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE level=VALUES(level), purchased_by=VALUES(purchased_by)',
    [userId, level, moderatorId]
  );
  return true;
}

async function removeVip(userId) {
  await getPool().query('DELETE FROM vip WHERE user_id=?', [userId]);
  return true;
}

// ---- Администраторы (повышение/понижение) ----
async function setAdmin(userId, level = 1, moderatorId = null) {
  await getPool().query(
    'INSERT INTO admins (user_id, level, added_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE level=VALUES(level), added_by=VALUES(added_by)',
    [userId, level, moderatorId]
  );
  await setVip(userId, level, moderatorId);
  return true;
}

async function removeAdmin(userId, moderatorId = null) {
  await getPool().query('DELETE FROM admins WHERE user_id=?', [userId]);
  return true;
}

async function listAdmins() {
  const [rows] = await getPool().query('SELECT user_id, level, added_at FROM admins ORDER BY level DESC');
  return rows;
}

// ---- Права команд ----
async function canUseCommand(userId, commandName, isDiscordAdmin = false) {
  const [admins] = await getPool().query('SELECT level FROM admins WHERE user_id=? LIMIT 1', [userId]);
  const userLevel = admins[0]?.level || 0;
  const [perms] = await getPool().query('SELECT min_admin_level FROM command_permissions WHERE command_name=? LIMIT 1', [commandName]);
  const required = perms[0]?.min_admin_level || 0;
  return userLevel >= required || isDiscordAdmin;
}

async function isCommandHidden(commandName) {
  const [rows] = await getPool().query('SELECT hidden FROM command_permissions WHERE command_name=? LIMIT 1', [commandName]);
  return !!rows[0]?.hidden;
}

// ---- Релей каналов ----
async function loadRelayChannels() {
  const [rows] = await getPool().query('SELECT guild_id, channel_id FROM relay_channels');
  const map = {};
  rows.forEach(row => { map[String(row.guild_id)] = String(row.channel_id); });
  return map;
}

async function setRelayChannel(guildId, channelId) {
  await getPool().query(
    'INSERT INTO relay_channels (guild_id, channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id)',
    [guildId, channelId]
  );
  return true;
}

async function removeRelayChannel(guildId) {
  await getPool().query('DELETE FROM relay_channels WHERE guild_id=?', [guildId]);
  return true;
}

// ---- Логи сообщений ----
async function logChatMessage({ author, authorId, guild, guildId, channelId, messageId, text, type, status, error }) {
  await getPool().query(
    `INSERT INTO chat_messages (author, author_id, guild, guild_id, channel_id, message_id, text, type, status, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [author, authorId, guild, guildId, channelId, messageId, text.slice(0, 4000), type, status, error ? error.slice(0, 500) : null]
  );
}

// ---- Профили ----
async function getProfile(userId) {
  const [rows] = await getPool().query('SELECT prefix, color, description FROM profiles WHERE user_id=? LIMIT 1', [userId]);
  return rows[0] || null;
}

async function setProfile(userId, nick, description) {
  const updates = [];
  const values = [];
  if (nick !== undefined && nick !== null) {
    updates.push('nick = ?');
    values.push(nick.slice(0, 32));
  }
  if (description !== undefined && description !== null) {
    updates.push('description = ?');
    values.push(description.slice(0, 120));
  }
  if (!updates.length) return;
  values.push(userId);
  await getPool().query(
    `INSERT INTO profiles (user_id, nick, description) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
    [userId, nick || null, description || null, ...values.slice(0, -1)]
  );
}

// ---- Предупреждения ----
async function addWarning(userId, moderatorId, reason) {
  await getPool().query(
    'INSERT INTO warnings (user_id, moderator_id, reason, active) VALUES (?, ?, ?, 1)',
    [userId, moderatorId, reason]
  );
  return true;
}

async function removeWarning(userId, moderatorId) {
  const [result] = await getPool().query(
    'DELETE FROM warnings WHERE user_id=? LIMIT 1',
    [userId]
  );
  return result.affectedRows > 0;
}

// ============================================================
//              ПЛАТЕЖИ – адаптировано под вашу БД
// ============================================================

async function createPayment(userId, type, amount, targetUserId, metadata) {
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const [result] = await getPool().query(
    `INSERT INTO payments 
      (invoice_id, user_id, type, sum, target_user_id, metadata, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
    [invoiceId, userId, type, amount, targetUserId, JSON.stringify(metadata || {})]
  );
  return { id: result.insertId, invoiceId };
}

async function getPaymentByInvoice(invoiceId) {
  const [rows] = await getPool().query('SELECT * FROM payments WHERE invoice_id=?', [invoiceId]);
  return rows[0] || null;
}

async function getPaymentById(paymentId) {
  const [rows] = await getPool().query('SELECT * FROM payments WHERE id=?', [paymentId]);
  return rows[0] || null;
}

async function updatePaymentStatus(paymentId, status) {
  await getPool().query('UPDATE payments SET status=? WHERE id=?', [status, paymentId]);
  return getPaymentById(paymentId);
}

async function updatePaymentProviderData(paymentId, providerUuid, providerUrl) {
  await getPool().query(
    'UPDATE payments SET provider=?, provider_payment_id=?, payment_url=? WHERE id=?',
    ['yooKassa', providerUuid, providerUrl, paymentId]
  );
}

async function ensurePaymentSuccess(paymentId) {
  const payment = await getPaymentById(paymentId);
  if (!payment) return null;
  if (payment.status === 'success') return payment;
  await getPool().query('UPDATE payments SET status="success" WHERE id=?', [paymentId]);
  return await getPaymentById(paymentId);
}

// ---- Уведомления о наказаниях ----
// Схема: id, punishment_id, punishment_type, target_id, moderator_id,
//        guild_id, status, error, detail, created_at
//   punishment_type - тип действия ('ban' | 'unban' | ...), varchar(32) NOT NULL
//   target_id       - пользователь, к которому применили
//   moderator_id    - модератор, выполнивший действие
//   status          - статус доставки уведомления, varchar(16) NOT NULL (default 'sent')
//   error           - текст ошибки доставки
//   detail          - JSON с причиной/сроком/каналом
async function logPunishmentNotification(type, userId, moderatorId, details) {
  const detail = JSON.stringify({
    reason:   details?.reason   ?? null,
    duration: details?.duration ?? null,
    channel:  details?.channel  ?? null,
  });

  // status NOT NULL: приоритет details.status, иначе 'failed' при наличии error, иначе 'sent'
  const status = details?.status != null
    ? String(details.status).slice(0, 16)
    : (details?.error ? 'failed' : 'sent');

  await getPool().query(
    `INSERT INTO punishment_notifications
       (punishment_type, target_id, moderator_id, status, error, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      String(type ?? 'unknown').slice(0, 32),                  // punishment_type, NOT NULL
      userId      != null ? String(userId).slice(0, 32)      : null, // target_id
      moderatorId != null ? String(moderatorId).slice(0, 32) : null, // moderator_id
      status,                                                  // status, NOT NULL
      details?.error != null ? String(details.error).slice(0, 4000) : null, // error
      detail,
    ]
  );
}

// ============================================================
//                      ЭКСПОРТ
// ============================================================

module.exports = {
  initDatabase,
  getPool,
  isGuildBanned,
  isUserBanned,
  banUser,
  unbanUser,
  banGuild,
  unbanGuild,
  isVip,
  setVip,
  removeVip,
  setAdmin,
  removeAdmin,
  listAdmins,
  canUseCommand,
  isCommandHidden,
  loadRelayChannels,
  setRelayChannel,
  removeRelayChannel,
  logChatMessage,
  getProfile,
  setProfile,
  addWarning,
  removeWarning,
  createPayment,
  getPaymentByInvoice,
  getPaymentById,
  updatePaymentStatus,
  updatePaymentProviderData,
  ensurePaymentSuccess,
  logPunishmentNotification,
  isAdmin,
};