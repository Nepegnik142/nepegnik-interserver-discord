const { EmbedBuilder } = require('discord.js');
const { CONFIG } = require('./config');

const adminIds = new Set(CONFIG.ADMIN_IDS);
const cooldowns = new Map();
const AD_REGEX = /(https?:\/\/|discord\.gg|discordapp\.com\/invite|t\.me\/|telegram\.me\/|@everyone|@here)/i;

function isBotAdmin(userId) { return adminIds.has(userId); }
function createEmbed({ title, description, color = 0x5865f2, fields = [] }) {
  const embed = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  return embed;
}
function parseDuration(value) {
  if (!value) return null;
  const match = /^([0-9]+)([smhdw])$/i.exec(value.trim());
  if (!match) return null;
  return Date.now() + Number(match[1]) * ({s:1000,m:60000,h:3600000,d:86400000,w:604800000}[match[2].toLowerCase()]);
}
function requireApiKey(req, res, next) {
  const key = req.get('x-api-key') || req.query.api_key || req.body?.api_key;
  if (!key || key !== CONFIG.API_KEY) return res.status(401).json({ ok:false, error:'Unauthorized' });
  next();
}
function canUseCooldown(userId, channelId) {
  const key = `${userId}:${channelId}`, now = Date.now(), last = cooldowns.get(key) || 0;
  if (now - last < 1000) return false;
  cooldowns.set(key, now);
  return true;
}
module.exports = { isBotAdmin, adminIds, createEmbed, parseDuration, AD_REGEX, requireApiKey, canUseCooldown };
