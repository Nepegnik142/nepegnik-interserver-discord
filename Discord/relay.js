const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPool, isUserBanned, logChatMessage, getProfile, isVip, isAdmin } = require('./database');

// Хранилище времени последнего сообщения пользователя в канале
const userCooldowns = new Map(); // ключ: "userId:channelId", значение: timestamp

// Конфигурация медленного режима (собственный коoldown)
const SLOWMODE_SECONDS = 15;

async function getRelayChannel(guildId) {
  const [rows] = await getPool().query('SELECT channel_id FROM relay_channels WHERE guild_id=? LIMIT 1', [guildId]);
  return rows[0]?.channel_id || null;
}

async function getAllRelayChannels() {
  const [rows] = await getPool().query('SELECT guild_id, channel_id FROM relay_channels');
  return rows;
}

function parseColor(value, fallback = 0x5865f2) {
  if (!value) return fallback;
  const n = parseInt(String(value).replace('#', ''), 16);
  return Number.isFinite(n) ? n : fallback;
}

function attachmentsPlaceholder(count) {
  if (!count) return null;
  if (count === 1) return '📎 1 вложение';
  if (count >= 2 && count <= 4) return `📎 ${count} вложения`;
  return `📎 ${count} вложений`;
}

function formatMessageBlock(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>');
}

async function getReplyInfo(message) {
  if (!message.reference?.messageId) return null;
  try {
    const replied = await message.channel.messages.fetch(message.reference.messageId);
    if (!replied) return null;
    return {
      authorName: replied.member?.displayName || replied.author?.username || 'Неизвестный пользователь',
      content: replied.content?.trim() || attachmentsPlaceholder(replied.attachments?.size || 0) || 'Без текста',
      jumpUrl: replied.url,
    };
  } catch {
    return null;
  }
}

async function buildRelayEmbed(message) {
  const userId = message.author.id;

  // Получаем данные пользователя
  const [profile, vipStatus, adminLevel] = await Promise.all([
    getProfile(userId),
    isVip(userId),
    isAdmin(userId),
  ]);

  // Префикс (кастомный из профиля)
  const prefix = profile?.prefix || '';
  const baseName = message.member?.displayName || message.author.username;

  // Приоритет статусов: ADMIN > VIP > USER. У админа всегда только [ADMIN].
  const systemPrefix = adminLevel > 0 ? '[ADMIN]' : (vipStatus ? '[VIP]' : '[USER]');
  let displayName = `${systemPrefix} ${baseName}`;

  const title = `${prefix ? prefix + ' ' : ''}${displayName}`.trim().slice(0, 256);
  const avatar = message.author.displayAvatarURL({ size: 256 });

  // Определяем цвет embed
  let embedColor;
  if (adminLevel > 0) {
    embedColor = 0xed4245; // красный — администратор
  } else if (vipStatus) {
    embedColor = 0xf1c40f; // жёлтый — VIP
  } else if (profile?.color) {
    embedColor = parseColor(profile.color);
  } else {
    embedColor = 0x5865f2; // стандартный синий
  }

  // Логируем статус в консоль
  const statusText = adminLevel > 0 ? 'ADMIN' : (vipStatus ? 'VIP' : 'обычный');
  console.log(`[Relay] ${message.author.tag} (${statusText}) → ${message.guild.name}`);

  // Формируем описание embed
  const descriptionParts = [];
  const replyInfo = await getReplyInfo(message);

  if (replyInfo) {
    descriptionParts.push(
      `💬 **Ответ на сообщение от ${replyInfo.authorName}:**\n> ${formatMessageBlock(replyInfo.content)}\n[Перейти к сообщению](${replyInfo.jumpUrl})`
    );
  }

  if (profile?.description) descriptionParts.push(`_${profile.description}_`);

  const content = message.content?.trim();
  if (content) descriptionParts.push(formatMessageBlock(content));
  else {
    const placeholder = attachmentsPlaceholder(message.attachments.size);
    if (placeholder) descriptionParts.push(placeholder);
  }

  if (!descriptionParts.length) descriptionParts.push(' ');

  const embed = new EmbedBuilder()
    .setAuthor({ name: title, iconURL: avatar })
    .setDescription(descriptionParts.join('\n\n').slice(0, 4096))
    .setColor(embedColor)
    .setFooter({ text: `${message.guild.name} • Межсерверный чат`.slice(0, 2048) })
    .setTimestamp(message.createdTimestamp);

  const components = [];
  if ((adminLevel > 0 || vipStatus) && /^https?:\/\//i.test(String(require('./config').CONFIG.SERVER_INVITE_URL || ''))) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Ссылка на сервер')
        .setStyle(ButtonStyle.Link)
        .setURL(require('./config').CONFIG.SERVER_INVITE_URL)
    ));
  }

  return {
    embed,
    attachments: [...message.attachments.values()],
    components,
  };
}

async function sendEmbedToTargets(embed, attachments = [], sourceGuildId = null, components = []) {
  const rows = await getAllRelayChannels();
  const client = require('./bot');
  const sent = [];
  const errors = [];

  await Promise.allSettled(rows.map(async row => {
    if (sourceGuildId && row.guild_id === String(sourceGuildId)) return;

    try {
      const channel = await client.channels.fetch(row.channel_id);
      if (!channel?.isTextBased()) throw new Error('Канал не текстовый или недоступен');

      const files = attachments.map(att => ({
        attachment: att.url,
        name: att.name || `attachment-${att.id}`,
      }));

      const sentMessage = await channel.send({
        embeds: [embed],
        components: components.length ? components : undefined,
        files: files.length ? files : undefined,
      });

      sent.push({
        guildId: row.guild_id,
        channelId: row.channel_id,
        messageId: sentMessage.id,
      });
    } catch (error) {
      errors.push({
        guildId: row.guild_id,
        channelId: row.channel_id,
        error: error?.message || String(error),
      });
    }
  }));

  return { sent, errors, total: rows.filter(r => !sourceGuildId || r.guild_id !== String(sourceGuildId)).length };
}

async function sendRelayMessage(text, author = {}, sourceGuildId = null, extra = {}) {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) throw new Error('Текст сообщения пустой');

  const embed = new EmbedBuilder()
    .setAuthor({ name: String(author.tag || author.username || 'InterServer').slice(0, 256) })
    .setDescription(clean)
    .setColor(extra.color || 0x5865f2)
    .setFooter({ text: extra.guildName ? `Источник: ${extra.guildName}` : 'InterServer Text Chat' })
    .setTimestamp();

  const result = await sendEmbedToTargets(embed, extra.attachments || [], sourceGuildId);

  await logChatMessage({
    author: String(author.tag || author.username || 'InterServer'),
    authorId: author.id || null,
    guild: extra.guildName || String(sourceGuildId || 'API'),
    guildId: sourceGuildId,
    channelId: extra.channelId || null,
    messageId: extra.messageId || null,
    text: clean,
    type: 'message',
    status: result.sent.length || !result.total ? 'sent' : 'failed',
    error: result.errors.length ? result.errors.map(e => e.error).join('; ') : null,
  });

  if (!result.sent.length && result.total) {
    throw new Error(`Не удалось отправить ни в один сервер: ${result.errors.map(e => e.error).join('; ')}`);
  }

  return { ok: true, sent: result.sent.length, total: result.total, errors: result.errors };
}

// ----- Функция для принудительной установки встроенного slowmode = 15 секунд во всех релейных каналах -----
async function resetSlowmodeForAllRelayChannels() {
  const rows = await getAllRelayChannels();
  const client = require('./bot');
  for (const row of rows) {
    try {
      const channel = await client.channels.fetch(row.channel_id);
      if (channel?.isTextBased() && typeof channel.setRateLimitPerUser === 'function') {
        await channel.setRateLimitPerUser(SLOWMODE_SECONDS);
        console.log(`Slowmode для канала ${row.channel_id} установлен в ${SLOWMODE_SECONDS} сек.`);
      }
    } catch (e) {
      console.error(`Не удалось установить slowmode для канала ${row.channel_id}:`, e.message);
    }
  }
}

// ----- Обработчик сообщений (с собственным коoldown) -----
async function handleMessage(message) {
  if (!message.guild || message.author.bot) return;

  const relayChannelId = await getRelayChannel(message.guild.id);
  if (!relayChannelId || relayChannelId !== message.channel.id) return;

  // ---- СОБСТВЕННЫЙ МЕДЛЕННЫЙ РЕЖИМ (не зависит от прав) ----
  const key = `${message.author.id}:${message.channel.id}`;
  const now = Date.now();
  const last = userCooldowns.get(key) || 0;
  const diff = (now - last) / 1000;

  if (diff < SLOWMODE_SECONDS) {
    await message.delete().catch(() => null);
    const warn = await message.channel.send({
      content: `<@${message.author.id}>, **подождите ещё ${Math.ceil(SLOWMODE_SECONDS - diff)} секунд** перед отправкой нового сообщения.`,
    }).catch(() => null);
    if (warn) setTimeout(() => warn.delete().catch(() => null), 5000);
    return;
  }

  // Проверка бана
  const banInfo = await isUserBanned(message.author.id);
  if (banInfo) {
    await message.delete().catch(() => null);
    const warning = await message.channel.send({
      content: `<@${message.author.id}>, ты в бане межсерверного чата.`,
    }).catch(() => null);
    if (warning) setTimeout(() => warning.delete().catch(() => null), 10000);
    return;
  }

  if (!message.content?.trim() && message.attachments.size === 0) return;

  try {
    const { embed, attachments, components } = await buildRelayEmbed(message);
    const result = await sendEmbedToTargets(embed, attachments, message.guild.id, components);

    await logChatMessage({
      author: message.member?.displayName || message.author.username,
      authorId: message.author.id,
      guild: message.guild.name,
      guildId: message.guild.id,
      channelId: message.channel.id,
      messageId: message.id,
      text: message.content?.trim() || attachmentsPlaceholder(message.attachments.size) || '',
      type: 'relay',
      status: result.sent.length || !result.total ? 'sent' : 'failed',
      error: result.errors.length ? result.errors.map(e => e.error).join('; ') : null,
    });

    // Обновляем время последнего успешного сообщения
    userCooldowns.set(key, now);

    await message.react(result.sent.length > 0 || result.total === 0 ? '✅' : '❌').catch(() => null);

    if (!result.sent.length && result.total > 0) {
      const errMsg = await message.reply(
        `❌ Не удалось переслать сообщение. Ошибка: ${result.errors.map(e => e.error).slice(0, 2).join('; ')}`
      ).catch(() => null);
      if (errMsg) setTimeout(() => errMsg.delete().catch(() => null), 7000);
    }

    console.log(`Сообщение переслано в ${result.sent.length} из ${result.total} целевых каналов`);
  } catch (error) {
    console.error('Text relay error:', error);
    await logChatMessage({
      author: message.member?.displayName || message.author.username,
      authorId: message.author.id,
      guild: message.guild.name,
      guildId: message.guild.id,
      channelId: message.channel.id,
      messageId: message.id,
      text: message.content?.trim() || attachmentsPlaceholder(message.attachments.size) || '',
      type: 'relay',
      status: 'failed',
      error: error?.message || String(error),
    }).catch(() => null);
    await message.react('❌').catch(() => null);
  }
}

module.exports = {
  handleMessage,
  sendRelayMessage,
  getRelayChannel,
  getAllRelayChannels,
  buildRelayEmbed,
  resetSlowmodeForAllRelayChannels,
};