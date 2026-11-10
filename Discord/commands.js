const { SlashCommandBuilder, REST, Routes, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CONFIG, t, commandLocale } = require('./config');
const { isBotAdmin, createEmbed, parseDuration } = require('./utils');
const {
  setRelayChannel, removeRelayChannel, setVip, removeVip, banUser, unbanUser,
  banGuild, unbanGuild, addWarning, removeWarning, setProfile, createPayment,
  db, isVip, updatePaymentProviderData, setAdmin, removeAdmin, listAdmins,
  canUseCommand, getProfile, logPunishmentNotification
} = require('./database');
const { createCheckout } = require('./payments');
const { SHOP_VIP, SHOP_PREFIXES, SHOP_COLORS, getShopItem, getCustomPrefixPrice } = require('./shop');
const { sendRelayMessage } = require('./relay');
const { setVoiceChannel, removeVoiceChannel } = require('./voice');

const adminNames = new Set(['setchannel','delchannel','setvoice','delvoice','osay','setvip','delvip','ban','unban','warn','unwarn','serverban','serverunban','setadmin','deladmin','admins']);

function protect(builder) {
  if (adminNames.has(builder.name) && String(process.env.HIDE_ADMIN_COMMANDS || 'true').toLowerCase() === 'true') {
    builder.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
  }
  return builder.setDMPermission(false).toJSON();
}

const commands = [
  new SlashCommandBuilder().setName('setchannel').setDescription('Настроить текстовый межсерверный чат').addChannelOption(o=>o.setName('channel').setDescription('Текстовый канал').setRequired(true)),
  new SlashCommandBuilder().setName('delchannel').setDescription('Отключить текстовый межсерверный чат'),
  new SlashCommandBuilder().setName('setvoice').setDescription('Подключить голосовой межсерверный чат').addChannelOption(o=>o.setName('channel').setDescription('Голосовой канал').setRequired(true)),
  new SlashCommandBuilder().setName('delvoice').setDescription('Отключить голосовой межсерверный чат'),
  new SlashCommandBuilder().setName('shop').setDescription('Открыть магазин'),
  new SlashCommandBuilder().setName('vip').setDescription('Магазин VIP'),
  new SlashCommandBuilder().setName('prefixes').setDescription('Магазин префиксов'),
  new SlashCommandBuilder().setName('colors').setDescription('Магазин цветов'),
  new SlashCommandBuilder().setName('buy-vip').setDescription('Купить VIP').addStringOption(o=>o.setName('item').setDescription('ID VIP').setRequired(true)),
  new SlashCommandBuilder().setName('buy-prefix').setDescription('Купить префикс').addStringOption(o=>o.setName('item').setDescription('ID товара').setRequired(true)),
  new SlashCommandBuilder().setName('buy-custom-prefix').setDescription('Купить кастомный префикс').addStringOption(o=>o.setName('prefix').setDescription('Ваш префикс, 1-16 символов').setRequired(true).setMinLength(1).setMaxLength(16)),
  new SlashCommandBuilder().setName('buy-color').setDescription('Купить цвет').addStringOption(o=>o.setName('item').setDescription('ID товара').setRequired(true)),
  new SlashCommandBuilder().setName('osay').setDescription('Отправить сообщение во все текстовые каналы').addStringOption(o=>o.setName('text').setDescription('Текст').setRequired(true).setMaxLength(2000)),
  new SlashCommandBuilder().setName('info').setDescription('Информация о боте'),
  new SlashCommandBuilder().setName('appeal').setDescription('Подать апелляцию на наказание'),
  new SlashCommandBuilder().setName('ban').setDescription('Заблокировать пользователя').addUserOption(o=>o.setName('user').setDescription('Пользователь').setRequired(true)).addStringOption(o=>o.setName('duration').setDescription('10m, 2h, 3d')).addStringOption(o=>o.setName('reason').setDescription('Причина')),
  new SlashCommandBuilder().setName('unban').setDescription('Разблокировать пользователя').addUserOption(o=>o.setName('user').setDescription('Пользователь').setRequired(true)),
  new SlashCommandBuilder().setName('setvip').setDescription('Выдать VIP').addUserOption(o=>o.setName('user').setDescription('Пользователь').setRequired(true)).addIntegerOption(o=>o.setName('level').setDescription('Уровень').setMinValue(1).setMaxValue(10)),
  new SlashCommandBuilder().setName('delvip').setDescription('Снять VIP').addUserOption(o=>o.setName('user').setDescription('Пользователь').setRequired(true)),
  new SlashCommandBuilder().setName('setadmin').setDescription('Выдать админку бота').addUserOption(o=>o.setName('user').setDescription('Пользователь').setRequired(true)).addIntegerOption(o=>o.setName('level').setDescription('Уровень 1-10').setMinValue(1).setMaxValue(10)),
  new SlashCommandBuilder().setName('deladmin').setDescription('Снять админку бота').addUserOption(o=>o.setName('user').setDescription('Пользователь').setRequired(true)),
  new SlashCommandBuilder().setName('admins').setDescription('Показать админов бота из БД'),
  new SlashCommandBuilder().setName('warn').setDescription('Выдать предупреждение').addUserOption(o=>o.setName('user').setDescription('Пользователь').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Причина')),
  new SlashCommandBuilder().setName('unwarn').setDescription('Снять предупреждение').addUserOption(o=>o.setName('user').setDescription('Пользователь').setRequired(true)),
  new SlashCommandBuilder().setName('serverban').setDescription('Заблокировать сервер').addStringOption(o=>o.setName('guildid').setDescription('ID сервера').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Причина')),
  new SlashCommandBuilder().setName('serverunban').setDescription('Снять блокировку сервера').addStringOption(o=>o.setName('guildid').setDescription('ID сервера').setRequired(true)),
  new SlashCommandBuilder().setName('setnick').setDescription('Установить ник').addStringOption(o=>o.setName('value').setDescription('Ник').setRequired(true).setMaxLength(32)),
  new SlashCommandBuilder().setName('setdescription').setDescription('Установить описание').addStringOption(o=>o.setName('value').setDescription('Описание').setRequired(true).setMaxLength(120)),
].map(protect);

async function registerCommands() {
  const rest = new REST({version:'10'}).setToken(CONFIG.TOKEN);
  await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), {body:commands});
}

async function adminOnly(i) {
  return canUseCommand(i.user.id, i.commandName, Boolean(i.memberPermissions?.has(PermissionFlagsBits.Administrator)));
}

async function createStorePayment(i, type, amount, metadata, description) {
  const payment = await createPayment(i.user.id, type, amount, i.user.id, metadata);
  const pay = await createCheckout({userId:i.user.id,targetUserId:i.user.id,type,amount,metadata,description:String(description).slice(0,200),invoiceId:payment.invoiceId});
  await updatePaymentProviderData(payment.id,pay.uuid,pay.url);
  return pay;
}


function appealRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Подать апелляцию').setStyle(ButtonStyle.Link).setURL(CONFIG.APPEAL_URL)
  );
}

async function punishmentNotify({client, target, moderator, action, reason, duration, guild}) {
  const titleMap = {ban:'🔨 Выдан бан', warn:'⚠️ Выдано предупреждение', unban:'🔓 Бан снят', unwarn:'✅ Предупреждение снято'};
  const title = titleMap[action] || '⚖️ Наказание';
  const durationText = duration ? String(duration) : (action === 'ban' ? 'Навсегда' : '—');
  const appeal = CONFIG.APPEAL_URL;
  const description = [
    `**Пользователь:** <@${target.id}> (${target.tag})`,
    `**Модератор:** <@${moderator.id}>`,
    guild ? `**Сервер:** ${guild.name}` : null,
    action === 'ban' || action === 'warn' ? `**Причина:** ${reason || 'Не указана'}` : null,
    action === 'ban' ? `**Срок:** ${durationText}` : null,
    `**Апелляция:** ${appeal}`,
  ].filter(Boolean).join('\n');
  const payload = { embeds: [createEmbed({title, description, color: action==='ban'||action==='warn' ? 0xed4245 : 0x57f287})], components: [appealRow()] };

  if (CONFIG.PUNISHMENT_DM_NOTIFICATIONS) {
    try {
      await target.send({
        content: action === 'ban' || action === 'warn' ? 'Вам было выдано наказание.' : 'Ваше наказание было снято.',
        ...payload,
      });
      await logPunishmentNotification(action, target.id, moderator.id, {reason, duration, channel:'dm', status:'sent'});
    } catch (err) {
      await logPunishmentNotification(action, target.id, moderator.id, {reason, duration, channel:'dm', status:'failed', error:String(err?.message || err)});
    }
  }

  if (CONFIG.PUNISHMENT_WEBHOOK_URL) {
    try {
      const { WebhookClient } = require('discord.js');
      const webhook = new WebhookClient({url: CONFIG.PUNISHMENT_WEBHOOK_URL});
      await webhook.send(payload);
      webhook.destroy();
      await logPunishmentNotification(action, target.id, moderator.id, {reason, duration, channel:'webhook', status:'sent'});
    } catch (err) {
      await logPunishmentNotification(action, target.id, moderator.id, {reason, duration, channel:'webhook', status:'failed', error:String(err?.message || err)});
    }
  }
}

async function handleInteraction(i) {
  if (!i.isChatInputCommand()) return;
  const locale = commandLocale(i);
  try {
    if (adminNames.has(i.commandName) && !(await adminOnly(i))) return i.reply({content:t(locale,'no_permission'),ephemeral:true});
    switch(i.commandName) {
      case 'setchannel': {
  const ch = i.options.getChannel('channel', true);
  if (!ch.isTextBased()) return i.reply({ content: 'Канал должен быть текстовым.', ephemeral: true });
  await ch.setRateLimitPerUser(15).catch(() => {}); // было 0 → 15
  await setRelayChannel(i.guildId, ch.id);
  return i.reply({ embeds: [createEmbed({ title: t(locale, 'channel_set'), description: `<#${ch.id}>` })] });
}      case 'delchannel': await removeRelayChannel(i.guildId); return i.reply({embeds:[createEmbed({title:t(locale,'channel_deleted')})]});
      case 'setvoice': {
        const ch=i.options.getChannel('channel',true);
        if (!ch.isVoiceBased()) return i.reply({content:'Канал должен быть голосовым.',ephemeral:true});
        const vipLevel=await isVip(i.user.id);
        const discordAdmin=Boolean(i.memberPermissions?.has(PermissionFlagsBits.Administrator));
        if (!discordAdmin || vipLevel<1) return i.reply({content:'❌ Для настройки межсерверного войса нужны Administrator на сервере и VIP в боте.',ephemeral:true});
        await setVoiceChannel(i.guildId,ch.id); return i.reply({embeds:[createEmbed({title:t(locale,'voice_set'),description:`<#${ch.id}>`})]});
      }
      case 'delvoice': await removeVoiceChannel(i.guildId); return i.reply({embeds:[createEmbed({title:t(locale,'voice_deleted')})]});
      case 'shop': return i.reply({embeds:[createEmbed({title:'🛒 Магазин',description:'Разделы разделены: /vip, /prefixes и /colors. Кастомный префикс — /buy-custom-prefix.'})]});
      case 'vip': return i.reply({embeds:[createEmbed({title:'💎 VIP',description:SHOP_VIP.map(x=>`**${x.id}** — ${x.name} — уровень ${x.level} — ${x.price} ₽`).join('\n')})]});
      case 'prefixes': return i.reply({embeds:[createEmbed({title:'🏷 Префиксы',description:SHOP_PREFIXES.map(x=>`**${x.id}** — ${x.preview} — ${x.price} ₽`).join('\n')})]});
      case 'colors': return i.reply({embeds:[createEmbed({title:'🎨 Цвета',description:SHOP_COLORS.map(x=>`**${x.id}** — ${x.name} — ${x.hex} — ${x.price} ₽`).join('\n')})]});
      case 'buy-vip': {
        const item=getShopItem('vip',i.options.getString('item',true)); if(!item) return i.reply({content:'VIP не найден. Открой /vip.',ephemeral:true});
        const pay=await createStorePayment(i,'vip',item.price,{vipLevel:item.level},`VIP ${item.name}`);
        return i.reply({content:`💎 ${item.name} — ${item.price} ₽\nОплата: ${pay.url}\nVIP активируется после подтверждения webhook.`,ephemeral:true});
      }
      case 'buy-prefix': {
        const item=getShopItem('prefix',i.options.getString('item',true)); if(!item) return i.reply({content:'Префикс не найден. Открой /prefixes.',ephemeral:true});
        const pay=await createStorePayment(i,'cosmetic',item.price,{itemType:'prefix',itemId:item.id},`Префикс ${item.name}`);
        return i.reply({content:`🏷 ${item.name} — ${item.price} ₽\nОплата: ${pay.url}`,ephemeral:true});
      }
      case 'buy-custom-prefix': {
        const value=i.options.getString('prefix',true).trim();
        if(!/^[\p{L}\p{N}\p{S}\p{P} _-]{1,16}$/u.test(value)) return i.reply({content:'Недопустимый префикс.',ephemeral:true});
        if(/@everyone|@here|https?:\/\/|discord\.gg|<@&/i.test(value)) return i.reply({content:'Этот префикс запрещён.',ephemeral:true});
        const price=getCustomPrefixPrice(value);
        const pay=await createStorePayment(i,'cosmetic',price,{itemType:'custom_prefix',customPrefix:value},`Кастомный префикс ${value}`);
        return i.reply({content:`✨ Кастомный префикс: ${value}\nЦена: ${price} ₽\nОплата: ${pay.url}`,ephemeral:true});
      }
      case 'buy-color': {
        const item=getShopItem('color',i.options.getString('item',true)); if(!item) return i.reply({content:'Цвет не найден. Открой /colors.',ephemeral:true});
        const pay=await createStorePayment(i,'cosmetic',item.price,{itemType:'color',itemId:item.id},`Цвет ${item.name}`);
        return i.reply({content:`🎨 ${item.name} — ${item.price} ₽\nОплата: ${pay.url}`,ephemeral:true});
      }
      case 'osay': {
        const result=await sendRelayMessage(i.options.getString('text',true),{tag:i.user.tag,username:i.user.username},i.guildId,{guildName:i.guild?.name,color:0xf1c40f});
        return i.reply({embeds:[createEmbed({title:'Отправлено',description:`Серверов: ${result.sent}`})]});
      }
      case 'info': return i.reply({embeds:[createEmbed({title:'InterServer',description:'Текстовый + межсерверный голосовой чат.',fields:[{name:'Серверов',value:String(i.client.guilds.cache.size),inline:true},{name:'Пользователей',value:String(i.client.users.cache.size),inline:true}]})]});
      case 'ban': {
        const target=i.options.getUser('user',true), duration=i.options.getString('duration'), reason=i.options.getString('reason')||'Не указано';
        if(duration&&!parseDuration(duration)) return i.reply({content:'Формат: 10m, 2h, 3d, 1w.',ephemeral:true});
        await banUser(target.id,i.user.id,duration,reason);
        await punishmentNotify({client:i.client,target,moderator:i.user,action:'ban',reason,duration,guild:i.guild}).catch(err=>console.error('Punishment notification error:',err));
        return i.reply({content:`${target.tag} заблокирован. Уведомление отправлено в настроенные каналы.`,ephemeral:true});
      }
      case 'unban': {
        const target=i.options.getUser('user',true); await unbanUser(target.id,i.user.id);
        await punishmentNotify({client:i.client,target,moderator:i.user,action:'unban',guild:i.guild}).catch(err=>console.error('Punishment notification error:',err));
        return i.reply({content:'Блокировка снята.',ephemeral:true});
      }
      case 'setvip': { const u=i.options.getUser('user',true); await setVip(u.id,i.options.getInteger('level')||1,i.user.id); return i.reply({content:`VIP выдан: ${u.tag}`,ephemeral:true}); }
      case 'delvip': await removeVip(i.options.getUser('user',true).id); return i.reply({content:'VIP снят.',ephemeral:true});
      case 'setadmin': { const u=i.options.getUser('user',true); await setAdmin(u.id,i.options.getInteger('level')||1,i.user.id); return i.reply({content:`Админка бота выдана ${u.tag}.`,ephemeral:true}); }
      case 'deladmin': await removeAdmin(i.options.getUser('user',true).id,i.user.id); return i.reply({content:'Админка бота снята.',ephemeral:true});
      case 'admins': { const rows=await listAdmins(); const text=rows.length?rows.map(x=>`<@${x.user_id}> — уровень ${x.level} — ${new Date(x.added_at).toLocaleString('ru-RU')}`).join('\n'):'Админов в БД нет.'; return i.reply({content:text,ephemeral:true,allowedMentions:{users:[]}}); }
      case 'warn': { const u=i.options.getUser('user',true); const reason=i.options.getString('reason')||'Не указано'; await addWarning(u.id,i.user.id,reason); await punishmentNotify({client:i.client,target:u,moderator:i.user,action:'warn',reason,guild:i.guild}).catch(err=>console.error('Punishment notification error:',err)); return i.reply({content:`Предупреждение выдано ${u.tag}.`,ephemeral:true}); }
      case 'unwarn': { const u=i.options.getUser('user',true); const ok=await removeWarning(u.id,i.user.id); if(ok) await punishmentNotify({client:i.client,target:u,moderator:i.user,action:'unwarn',guild:i.guild}).catch(err=>console.error('Punishment notification error:',err)); return i.reply({content:ok?'Предупреждение снято.':'Активных предупреждений нет.',ephemeral:true}); }
      case 'appeal': return i.reply({content:`⚖️ Апелляция на наказание
Нажмите кнопку ниже, чтобы подать апелляцию.`,components:[appealRow()],ephemeral:true});
      case 'serverban': { const id=i.options.getString('guildid',true), reason=i.options.getString('reason')||'Не указано'; await banGuild(id,i.user.id,reason); const g=i.client.guilds.cache.get(id); if(g) await g.leave().catch(()=>{}); return i.reply({content:`Сервер ${id} заблокирован.`,ephemeral:true}); }
      case 'serverunban': await unbanGuild(i.options.getString('guildid',true),i.user.id); return i.reply({content:'Блокировка сервера снята.',ephemeral:true});
      case 'setnick': await setProfile(i.user.id,i.options.getString('value'),null); return i.reply({content:'Ник обновлён.',ephemeral:true});
      case 'setdescription': await setProfile(i.user.id,null,i.options.getString('value')); return i.reply({content:'Описание обновлено.',ephemeral:true});
    }
  } catch(e) {
    console.error('Command error:',e);
    if(!i.replied&&!i.deferred) await i.reply({content:`❌ ${e.message}`,ephemeral:true}).catch(()=>{});
  }
}
module.exports={commands,registerCommands,handleInteraction};
