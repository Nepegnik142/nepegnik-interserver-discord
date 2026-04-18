const { Client, EmbedBuilder, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, REST, Routes,  ActivityType,  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageActionRow, SelectMenuBuilder} = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const emojione = require('emojione');

const fs = require('fs');
const userData = JSON.parse(fs.readFileSync('users.json', 'utf8'));
let premiumUsers = require('./premiumUsers.json');
let targetChannelIds = [];
let bannedUsers = [];
let donatePrivileges = {};
let badges = {};
badges = fs.existsSync('badges.json') ? JSON.parse(fs.readFileSync('badges.json', 'utf8')) : {};

try {
  targetChannelIds = JSON.parse(fs.readFileSync('targetChannels.json', 'utf8'));
  bannedUsers = JSON.parse(fs.readFileSync('bannedUsers.json', 'utf8'));
  donatePrivileges = JSON.parse(fs.readFileSync('donatePrivileges.json', 'utf8'));
  badges = JSON.parse(fs.readFileSync('badges.json', 'utf8'));
  emojis = JSON.parse(fs.readFileSync('emojis.json', 'utf8'));
} catch (error) {
  console.error('Ошибка чтения файла:', error);
}


const allowedUserIds = ['ID 1', 'ID 2', 'ID 3']; // замените на свои ID пользователей

client.once('ready', () => {
  client.user.setPresence({
    activities: [{
        name: '/info',
        type: ActivityType.Watching,
    }],
    status: 'online'
});
  console.log('Бот запущен!');
  client.application.commands.set(commands);
});
function hasPremium(userId) {
  return premiumUsers[userId] && premiumUsers[userId] > Date.now();
}

const commands = [
  new SlashCommandBuilder()
   .setName('warn')
   .setDescription('Выдать предупреждение пользователю')
   .addUserOption(option => option.setName('user').setDescription('Пользователь для предупреждения').setRequired(true))
   .addStringOption(option => option.setName('reason').setDescription('Причина предупреждения')),
  new SlashCommandBuilder()
   .setName('rcon')
   .setDescription('Админская команда. ДИиди!')
   .addStringOption(option => option.setName('message').setDescription('Мессейдж!')),
  new SlashCommandBuilder()
  .setName('news')
  .setDescription('Команда новостей')
  .addStringOption(option => 
    option.setName('messsage')
    .setDescription('Мессейдж!')
    .setRequired(true)
  )
  .addStringOption(option => 
    option.setName('title')
    .setDescription('Заголовок')
    .setRequired(true)
  ),
  new SlashCommandBuilder().setName('donate').setDescription('donate')
  .addIntegerOption(option => option.setName('amount').setDescription('Баланс').setRequired(true)),
new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Забанить на время')
  .addUserOption(option => option.setName('user').setDescription('Юзер').setRequired(true))
  .addStringOption(option => option.setName('reason').setDescription('Причина').setRequired(true))
  .addStringOption(option => option.setName('time').setDescription('Время').setRequired(true))
  .addStringOption(option => option
    .setName('unit')
    .setDescription('В размерах')
    .setRequired(true)
    .addChoices(
      { name: 'seconds', value: 'seconds' },
      { name: 'minutes', value: 'minutes' },
      { name: 'hours', value: 'hours' },
      { name: 'days', value: 'days' }
    )
  ),
  new SlashCommandBuilder()
   .setName('unban')
   .setDescription('Разбанить пользователя')
   .addUserOption(option => option.setName('user').setDescription('Пользователь для разбана').setRequired(true)),
   new SlashCommandBuilder().setName('addpremium').setDescription('Добавить премиум пользователю')
   .addUserOption(option => option.setName('member').setDescription('Пользователь для добавления премиума').setRequired(true))
   .addIntegerOption(option => option.setName('durations').setDescription('Время').setRequired(true)),
  new SlashCommandBuilder().setName('removepremium').setDescription('Удалить премиум у пользователя')
    .addUserOption(option => option.setName('member').setDescription('Пользователь для удаления премиума').setRequired(true)),
  new SlashCommandBuilder()
   .setName('setchannel')
   .setDescription('Добавить канал в список целевых каналов')
   .addChannelOption(option => option.setName('channel').setDescription('Канал для добавления').setRequired(true)),
  new SlashCommandBuilder()
   .setName('delchannel')
   .setDescription('Удалить канал из списка целевых каналов')
   .addChannelOption(option => option.setName('channel').setDescription('Канал для удаления').setRequired(true)),
  new SlashCommandBuilder()
   .setName('setdonate')
   .setDescription('Установить привилегию доната для пользователя')
   .addUserOption(option => option.setName('user').setDescription('Пользователь для установки привилегии').setRequired(true))
   .addStringOption(option => option.setName('privileg').setDescription('Привилегия для установки')),
  new SlashCommandBuilder()
   .setName('info')
   .setDescription('Информация о пользователе'),
  new SlashCommandBuilder()
   .setName('addbadges')
   .setDescription('Добавить бейдж к пользователю')
   .addUserOption(option => option.setName('user').setDescription('Пользователь для добавления бейджа').setRequired(true))
   .addStringOption(option => option.setName('badgeee').setDescription('Бейдж для добавления')),
   new SlashCommandBuilder().setName('profile').setDescription('профиль'),
];

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const command = interaction.commandName;
  const args = interaction.options;

  switch (command) {
case 'rcon':
  if (!allowedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'У вас нет прав на использование этой команды.', ephemeral: true });
    return;
  }
  await interaction.reply({ content: 'Команда выполнена.', ephemeral: true });
  const message = args.getString('message');
  const rconEmbed = new EmbedBuilder()
    .setColor('#ffff00')
    .setTitle('RCON')
    .setDescription(`${message}`)
  try {
    for (const channelId of targetChannelIds) {
      const targetChannel = client.channels.cache.get(channelId);
      if (!targetChannel) {
        console.error(`RCON не отправился на каналы: ${channelId}`);
        continue;
      }
      targetChannel.send({ embeds: [rconEmbed] });
    }
  } catch (error) {
    console.error('Ошибка отправки:', error);
  }
  break;
case 'news':
  if (!allowedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'У вас нет прав на использование этой команды.', ephemeral: true });
    return;
  }
  const messsage = args.getString('messsage');
  const title = args.getString('title');
  await interaction.reply({ content: 'Уже спешу разослать.', ephemeral: true });
  const newsEmbed = new EmbedBuilder()
    .setColor('#ffff00')
    .setTitle(`${title}`)
    .setDescription(`${messsage}`)
  try {
    for (const channelId of targetChannelIds) {
      const targetChannel = client.channels.cache.get(channelId);
      if (!targetChannel) {
        console.error(`Новости не отправлены на каналы: ${channelId}`);
        continue;
      }
      targetChannel.send({ embeds: [newsEmbed] });
    }
  } catch (error) {
    console.error('Ошибка отправки:', error);
  }
  break;
  case 'donate':
    const amount = interaction.options.getInteger('amount');
    const userr = interaction.user;
    const usersData = JSON.parse(fs.readFileSync('users.json', 'utf8'));
    const developerId = 'Ваш ID дискорда'

  
    if (!amount) {
      await interaction.reply('Пожалуйста, укажите сумму доната!');
      return;
    }
  
    const donateEmbed = new EmbedBuilder()
      .setTitle('Донат')
      .setDescription(`Вы перевели на карту: ваша карта (ФИ) на сумму: ${amount}R разработчику?`)
      .setColor('#0099ff');
  
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('accept_donate')
          .setLabel('Отправить')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('decline_donate')
          .setLabel('Отмена')
          .setStyle(ButtonStyle.Danger),
      );
  
    const msg = await interaction.reply({ embeds: [donateEmbed], components: [row] });
  
    const filter = (i) => i.customId === 'accept_donate' || i.customId === 'decline_donate';
    const collector = msg.createMessageComponentCollector({ filter, time: 15000 });
  
    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Пиратам нельзя(', ephemeral: true });
        return;
      }
      if (i.customId === 'accept_donate') {
        await i.update({ content: `Вы отправили ${amount}R разработчику!`, components: [] });
    
        const devEmbed = new EmbedBuilder()
          .setTitle('Донат подтверждение')
          .setDescription(`Вы получили ${amount}R от ${userr.username}. Подтвердите получение доната.`)
          .setColor('#0099ff');
    
        const devRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('confirm_donate')
              .setLabel('Подтвердить')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('decline_donate_dev')
              .setLabel('Отклонить')
              .setStyle(ButtonStyle.Danger),
          );
    
        const dev = await client.users.fetch(developerId);
        const devMessage = await dev.send({ embeds: [devEmbed], components: [devRow] });
    
        const devCollector = devMessage.createMessageComponentCollector({ filter: (i) => i.customId === 'confirm_donate' || i.customId === 'decline_donate_dev' });
    
        devCollector.on('collect', async (i) => {
          if (i.customId === 'confirm_donate') {
            await i.update({ content: 'Донат подтвержден!', components: [] });
    
            if (usersData[userr.id]) {
              usersData[userr.id].balance += amount;
              fs.writeFileSync('users.json', JSON.stringify(usersData, null, 2));
            }
    
            const userEmbed = new EmbedBuilder()
              .setTitle('Донат подтвержден!')
              .setDescription(`Ваш донат в размере ${amount}R был подтвержден разработчиком.`)
              .setColor('#0099ff');
    
            await interaction.user.send({ embeds: [userEmbed] });
    
          } else {
            await i.update({ content: 'Донат отклонен!', components: [] });
          }
        });
    
      } else {
        await i.update({ content: 'Донат отменен!', components: [] });
      }
    });
    break;
case 'warn':
  if (!allowedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'У вас нет прав на использование этой команды.', ephemeral: true });
    return;
  }
  const userToWarn = args.getUser('user');
  const reasons = args.getString('reason');
  const warnEmbed = new EmbedBuilder()
    .setColor('#ffff00')
    .setDescription(`@${userToWarn.username} предупрежден, причина: ${reasons}`)
  try {
    for (const channelId of targetChannelIds) {
      const targetChannel = client.channels.cache.get(channelId);
      if (!targetChannel) {
        console.error(`Оповещение о варне не дошло до каналов: ${channelId}`);
        continue;
      }
      targetChannel.send({ embeds: [warnEmbed] });
    }
  } catch (error) {
    console.error('Ошибка отправки предупреждения:', error);
  }
  break;
case 'ban':
  if (!allowedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'У вас нет прав на использование этой команды.', ephemeral: true });
    return;
  }
  const userToBan = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  const time = interaction.options.getString('time');
  const unit = interaction.options.getString('unit');
  let banDuration;
  switch (unit) {
    case 'seconds':
      banDuration = parseInt(time) * 1000;
      break;
    case 'minutes':
      banDuration = parseInt(time) * 60 * 1000;
      break;
    case 'hours':
      banDuration = parseInt(time) * 60 * 60 * 1000;
      break;
    case 'days':
      banDuration = parseInt(time) * 24 * 60 * 60 * 1000;
      break;
    default:
      await interaction.reply({ content: 'Неправильное использование команды. Используйте "seconds", "minutes", "hours" или "days".' });
      return;
  }
  const banExpiration = Date.now() + banDuration;
  const hours = Math.floor(banDuration / 3600000);
  const minutes = Math.floor((banDuration % 3600000) / 60000);
const userIds = interaction.user.id;
 const badgee = badges[userIds] && badges[userIds][0] || '';
 const privilegeee = donatePrivileges[userIds] && donatePrivileges[userIds][0] || 'USER';
  interaction.client.users.fetch(userToBan.id).then(user => {
    user.send(`Вы были забанены в межсервере!\nАдмин: ${interaction.user.username}${badgee}\nЕго привилегия: ${privilegeee} \nПричина: ${reason}\nСрок бана: ${hours} часов ${minutes} минут.\n[Нажми, чтобы обжаловать](https://discord.gg/AyHRNBbJxM)`);
  });
  if (!bannedUsers.some(user => user.id === userToBan.id)) {
    bannedUsers.push({ id: userToBan.id, reason: reason, expiration: banExpiration });
    fs.writeFileSync('bannedUsers.json', JSON.stringify(bannedUsers));
  }

  await interaction.reply({ content: `Пользователь ${userToBan.username} был забанен на ${time} ${unit} по причине: ${reason}.` });

  setTimeout(() => {
    bannedUsers = bannedUsers.filter(user => user.id !== userToBan.id);
    fs.writeFileSync('bannedUsers.json', JSON.stringify(bannedUsers));
    interaction.client.users.fetch(userToBan.id).then(user => {
      user.send(`Вы были разбанены!\nАдмином: Console\nПривилегия: БОТ`);
    });
  }, banDuration);
  break;
case 'unban':
  if (!allowedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'У вас нет прав на использование этой команды.', ephemeral: true });
    return;
  }
const userIdd = interaction.user.id;
 const badge = badges[userIdd] && badges[userIdd][0] || '';
 const privilegee = donatePrivileges[userIdd] && donatePrivileges[userIdd][0] || 'USER';
  const userToUnban = interaction.options.getUser('user');
  const index = bannedUsers.findIndex(user => user.id === userToUnban.id);
  if (index === -1) {
    await interaction.reply({ content: `Пользователь ${userToUnban.username} не был забанен.` });
    return;
  }
  interaction.client.users.fetch(userToUnban.id).then(user => {
    user.send(`Вы были разбанены: ${interaction.user.username}${badge}\nЕго привилегия: ${privilegee}`);
  });
  bannedUsers.splice(index, 1);
  fs.writeFileSync('bannedUsers.json', JSON.stringify(bannedUsers));
  await interaction.reply({ content: `Пользователь ${userToUnban.username} был разбанен.` });
  break;
    case 'setchannel':
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'У вас нет прав администратора на этом сервере.', ephemeral: true });
        return;
      }
      const channelToAdd = args.getChannel('channel');
      if (!targetChannelIds.includes(channelToAdd.id)) {
        targetChannelIds.push(channelToAdd.id);
        fs.writeFileSync('targetChannels.json', JSON.stringify(targetChannelIds));
      }
      await interaction.reply({ content: `Канал ${channelToAdd.name} был добавлен в список целевых каналов.` });
      break;
    case 'delchannel':
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'У вас нет прав администратора на этом сервере.', ephemeral: true });
        return;
      }
      const channelToRemove = args.getChannel('channel');
      if (targetChannelIds.includes(channelToRemove.id)) {
        targetChannelIds.splice(targetChannelIds.indexOf(channelToRemove.id), 1);
        fs.writeFileSync('targetChannels.json', JSON.stringify(targetChannelIds));
     }
      await interaction.reply({ content: `Канал ${channelToRemove.name} был удален из списка целевых каналов.` });
      break;
case 'addbadges':
  if (!allowedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'У вас нет прав на использование этой команды.', ephemeral: true });
    return;
  }
  const userToAddBadge = args.getUser('user');
  const badgeee = args.getString('badgeee');
  if (!badges[userToAddBadge.id]) {
    badges[userToAddBadge.id] = [];
  }
  (badges[userToAddBadge.id] ??= []).push(badgeee);
  fs.writeFileSync('badges.json', JSON.stringify(badges));
  await interaction.reply({ content: `Бейдж ${badgeee} был добавлен к пользователю ${userToAddBadge.username}.` });
      break;

case 'addpremium':
  if (!allowedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'У вас нет прав на использование этой команды.', ephemeral: true });
    return;
  }
  const addPremiumMember = interaction.options.getUser('member');
  const durations = interaction.options.getInteger('durations');

  if (!durations) {
    await interaction.reply({ content: 'Вы не указали длительность премиума.', ephemeral: true });
    return;
  }

  const expiresAt = Date.now() + (durations * 1000);

  premiumUsers[addPremiumMember.id] = expiresAt;
  fs.writeFile('premiumUsers.json', JSON.stringify(premiumUsers), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`Дал премиум ${addPremiumMember.username} на ${durations} минут`);
    }
  });

  setInterval(() => {
    for (const userId in premiumUsers) {
      if (premiumUsers[userId] < Date.now()) {
        delete premiumUsers[userId];
        fs.writeFile('premiumUsers.json', JSON.stringify(premiumUsers), (err) => {
          if (err) {
            console.error(err);
          } else {
            console.log(`Премиум ${userId} истек`);
          }
        });
      }
    }
  }, 1000);

      await interaction.reply(`Пользователь ${addPremiumMember.username} получил премиум на ${durations} минут`);
      break;

case 'removepremium':
  if (!allowedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'У вас нет прав на использование этой команды.', ephemeral: true });
    return;
  }
  const removePremiumMember = interaction.options.getUser('member');
  delete premiumUsers[removePremiumMember.id];
  fs.writeFile('premiumUsers.json', JSON.stringify(premiumUsers), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`Убрал премку ${removePremiumMember.username}`);
    }
  });
  await interaction.reply(`Пользователь ${removePremiumMember.username} лишился премиума`);
  break;
  case 'profile':
  const user = interaction.user;
  const userId = interaction.user.id;
  const userData = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const premiumUsersData = JSON.parse(fs.readFileSync('premiumUsers.json', 'utf8'));

  if (!userData[user.id]) {
    userData[user.id] = {
      name: user.username,
      nickname: user.username,
      prefix: null,
      balance: 0,
      premium: false,
    };
    fs.writeFileSync('users.json', JSON.stringify(userData, null, 2));
  }
  const privilege = donatePrivileges[userId] && donatePrivileges[userId][0] || 'USER';
  const embed = new EmbedBuilder()
    .setTitle('Профиль')
    .setDescription(`Имя: ${userData[user.id].name}\nПривилегия: ${privilege} \nБаланс: ${userData[user.id].balance}R`)
    .setColor('#0099ff');

  const row1 = new ActionRowBuilder()
    .addComponents(
      new SelectMenuBuilder()
        .setCustomId('premium_purchase')
        .setPlaceholder('Купить премиум')
        .addOptions([
          {
            label: 'Купить на минуту - 10R',
            value: 'buy_premium_minute',
          },
          {
            label: 'Купить на день - 30R',
            value: 'buy_premium_day',
          },
          {
            label: 'Купить на неделю - 50R',
            value: 'buy_premium_week',
          },
          {
            label: 'Купить на месяц - 150R',
            value: 'buy_premium_month',
          },
          {
            label: 'Купить навсегда - 200R',
            value: 'buy_premium_forever',
          },
        ]),
    );
  const row3 = new ActionRowBuilder()
    .addComponents(
      new SelectMenuBuilder()
        .setCustomId('prefix_purchase')
        .setPlaceholder('Купить Префикс')
        .addOptions([
          {
            label: 'BroNepegnik - 150R',
            value: 'buy_bronepegnik',
          },
          {
            label: 'ImPopular - 100R',
            value: 'buy_popular',
          },
          {
            label: 'NepegnikIsMy - 160R',
            value: 'buy_nepegni',
          },
          {
            label: 'OWNER - 195R',
            value: 'buy_owner',
          },
        ]),
    );
  
  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('transfer_balance')
        .setLabel('Перевести баланс')
        .setStyle('Primary'),
    );
  
  await interaction.reply({ embeds: [embed], components: [row1, row3, row2] });


  const filteer = (i) => i.customId.startsWith('buy_') && i.user.id === user.id;
  const collectoor = interaction.channel.createMessageComponentCollector({ filteer, time: 30000 });

  collectoor.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: 'Пиратам нельзя(', ephemeral: true });
      return;
    }
    
    if (i.customId === 'prefix_purchase') {
      const selectedOption = i.values[0];
      const priceMap = {
        buy_bronepegnik: 150,
        buy_popular: 100,
        buy_nepegni: 160,
        buy_owner: 195,
      };
      const prefixMap = {
        buy_bronepegnik: 'БроНепегника',
        buy_popular: 'Популярный',
        buy_nepegni: 'НепегникМой!',
        buy_owner: 'Создатель',
      };
      if (userData[user.id].balance < priceMap[selectedOption]) {
        await i.deferUpdate();
        await i.update({ content: 'У вас недостаточно средств!', components: [] });
        return;
      }
    
      userData[user.id].balance -= priceMap[selectedOption];
    
      const donatePrivileges = JSON.parse(fs.readFileSync('donatePrivileges.json', 'utf8'));
      if (!donatePrivileges[user.id]) {
        donatePrivileges[user.id] = [];
      }
      donatePrivileges[user.id].push(prefixMap[selectedOption]);
    
      fs.writeFileSync('donatePrivileges.json', JSON.stringify(donatePrivileges, null, 2));
      fs.writeFileSync('users.json', JSON.stringify(userData, null, 2));
      await i.update({ content: `Вы купили префикс ${prefixMap[selectedOption]}!`, components: [] });
    } else if (i.customId === 'premium_purchase') {
      const selectedOption = i.values[0];
      const priceMap = {
        buy_premium_minute: 10,
        buy_premium_day: 30,
        buy_premium_week: 50,
        buy_premium_month: 150,
        buy_premium_forever: 200,
      };
      const premiumTypeMap = {
        buy_premium_minute: 'minute',
        buy_premium_day: 'day',
        buy_premium_week: 'week',
        buy_premium_month: 'month',
        buy_premium_forever: 'forever',
      };
      const expirationMap = {
        buy_premium_minute: 60000,
        buy_premium_day: 86400000,
        buy_premium_week: 604800000,
        buy_premium_month: 2629800000,
        buy_premium_forever: 999999999999,
      };
      
      if (userData[user.id].premium) {
        await i.update({ content: 'Вы уже имеете премиум!', components: [] });
        return;
      }
      
      if (userData[user.id].balance < priceMap[selectedOption]) {
        await i.update({ content: 'У вас недостаточно средств!', components: [] });
        return;
      }
      
      userData[user.id].balance -= priceMap[selectedOption];
      userData[user.id].premium = true;
      userData[user.id].premiumExpiration = Date.now() + expirationMap[selectedOption];
      
      fs.writeFileSync('users.json', JSON.stringify(userData, null, 2));
      fs.writeFileSync('premiumUsers.json', JSON.stringify({ [user.id]: userData[user.id].premiumExpiration }, null, 2));
      await i.update({ content: `Вы купили премиум на ${premiumTypeMap[selectedOption]}!`, components: [] });
      

      function checkExpiration() {
        if (userData[user.id].premiumExpiration < Date.now() / 10) {
          removePremium(user.id);
          interaction.client.users.fetch(user.id).then(user => {
            user.send(`У вас сняли премиум\nАдмин: Nepegnik InterServer\nПривилегия: БОТ`);
          });
        }
      }
   

  setInterval(checkExpiration, expirationMap[selectedOption]);
    } else if (i.customId === 'transfer_balance') {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Пиратам нельзя ,пидары(', ephemeral: true });
        return;
      }
      const transferEmbed = new EmbedBuilder()
        .setTitle('Перевести баланс')
        .setDescription('Введите ID пользователя, которому вы хотите перевести баланс:')
        .setColor('#0099ff');
        
        await i.deferUpdate();
      await i.update({ embeds: [transferEmbed], components: [] });
    
      const transferFilter = (m) => m.author.id === user.id;
      const transferCollector = interaction.channel.createMessageCollector({ filter: transferFilter, time: 30000 });
    
      transferCollector.on('collect', async (m) => {
        const input = m.content.trim();
        const targetUsername = input.split(' ')[0];
        let targetUserData;
        
      
        Object.keys(userData).forEach((userId) => {
          if (userData[userId].name === targetUsername) {
            targetUserData = userData[userId];
          }
        });
      
        if (!targetUserData) {
          await m.reply('Пользователь не найден в базе данных!');
          return;
        }
        
      
        const match = input.match(/\d+/);
        if (!match) {
          await m.reply('Неверная сумма!');
          return;
        }
        const amount = parseInt(match[0]);
      
        if (userData[m.author.id].balance < amount) {
          await m.reply('У вас недостаточно средств!');
          return;
        }
      
        userData[m.author.id].balance -= amount;
        targetUserData.balance += amount;
      
        fs.writeFileSync('users.json', JSON.stringify(userData, null, 2));

        await m.reply(`Вы перевели ${amount}R пользователю ${targetUsername}!`)
        transferCollector.stop();
      });
    }
  });

  break;
case 'setdonate':
  if (!allowedUserIds.includes(interaction.user.id)) {
    await interaction.reply({ content: 'У вас нет прав на использование этой команды.', ephemeral: true });
    return;
  }

  const userToSetDonate = args.getUser('user');
  const privileg = args.getString('privileg');

  if (!donatePrivileges) {
    donatePrivileges = {};
  }

  if (!donatePrivileges[userToSetDonate.id]) {
    donatePrivileges[userToSetDonate.id] = [];
  }

  if (!donatePrivileges[userToSetDonate.id].includes(privileg)) {
    donatePrivileges[userToSetDonate.id].push(privileg);
    fs.writeFileSync('donatePrivileges.json', JSON.stringify(donatePrivileges));
    await interaction.reply({ content: `Привилегия доната ${privileg} была установлена для пользователя ${userToSetDonate.username}.` });
  } else {
    await interaction.reply({ content: `Привилегия доната ${privileg} уже установлена для пользователя ${userToSetDonate.username}.` });
  }
break;
case 'info':
  const infoembed = new EmbedBuilder()
    .setTitle('Информация о боте')
    .setDescription('Межсерверный бот - это когда общаются между серверами, не заходя на них.')
    .addFields([
      { name: 'Версия', value: '1.1', inline: true},
      { name: 'Nodejs version', value: `${process.version}`, inline: true },

      { name: 'Автор', value: 'nepegnik', inline: true },
        { name: 'Обязательное', value: 'Все права зашифрованы от JuiceWrld(Куплены), NepegnikInterServer -  ⓒ2024, все права заденисили', inline: true },
    ])
    .setColor(0x0099ff);

  await interaction.reply({ embeds: [infoembed] });
  break;
default:
  await interaction.reply({ content: 'Неизвестная команда.' });
      break;
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const messageContent = message.cleanContent;
  const content = message.content;
  const description = extractEmojisFromMessage(message, content);
  const userId = message.author.id;
  const user = message.author;
  const guild = message.guild;

  if (targetChannelIds.includes(message.channel.id)) {
    let timeLeft = '';
    if (bannedUsers.some(user => user.id === userId)) {
      let reason = '';
      let banDuration = '';
      for (let i = 0; i < bannedUsers.length; i++) {
        if (bannedUsers[i].id === userId) {
          reason = bannedUsers[i].reason;
          banDuration = bannedUsers[i].expiration - Date.now();
          break;
        }
      }
      if (!reason) {
        reason = 'Не указана';
      }
      timeLeft = formatTime(banDuration);
      const banTimeLeft = formatTime(banDuration);
         await message.react('❌');
      return; 
    }
    for (const channelId of targetChannelIds) {
      if (channelId !== message.channel.id) {
        const targetChannel = client.channels.cache.get(channelId);
        if (!targetChannel) {
          console.error(`Канал не найден: ${channelId}`);
          continue;
        }

        try {
          const premiumUsersData = JSON.parse(fs.readFileSync('premiumUsers.json', 'utf8'));
          const premiumUserss = Object.keys(premiumUsersData);
          const privilege = donatePrivileges[userId] && donatePrivileges[userId][0] || 'USER';
          const badge = badges[userId] && badges[userId][0] || '';
          const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`**${privilege}** ${message.author.username} ${badge} `)
            .setDescription(`${description}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }));

          if (message.reference) {
            const repliedMessage = message.channel.messages.cache.get(message.reference.messageId);
            if (repliedMessage) {
              const repliedUsername = repliedMessage.author.username;
              embed.setDescription(`Ответ на сообщение ${repliedUsername}: ${message.cleanContent}`);
            }
          } else if (message.attachments.size > 0) {
            if (premiumUserss.includes(message.author.id)) {
              embed.setDescription(`${privilege}  | ${message.author.username} прислал изображение`);
              embed.setImage(message.attachments.first().url);
              await targetChannel.send({ embeds: [embed] });
            } else {
              await message.react('⏹️');
              return;
            }
          };

          embed.setFooter({
            text: `Server: ${message.guild.name}, ID:${userId} channelId ${message.channel.id}`,
            iconURL: guild.iconURL(),
          });
         await message.react('✔');
        await targetChannel.send({ embeds: [embed] });

        } catch (error) {
          console.error(`Ошибка отправки сообщения в канал ${channelId}: ${error.message}`);
          console.error(error.stack);
        }
      }
    }
  }
});
function hasPremiumm(userId) {
  return premiumUsers[userId] && premiumUsers[userId] > Date.now();
}
function decodeMessageContent(content) {
  content = decodeURIComponent(content);
  content = content.replace(emojiRegex, (match, emojiName, emojiId) => {
    const unicodeEmoji = getUnicodeEmoji(emojiName, emojiId);
    return unicodeEmoji || match;
  });

  return content;
}
function extractEmojisFromMessage(message, content) {
  const emojiRegex = /\:(.*?)\:/g;
  const emojiMatches = content.match(emojiRegex);
  let description = `⋙ ${content}`;

  if (emojiMatches) {
    emojiMatches.forEach((match) => {
      const emojiName = match.replace(/:/g, '');
      const guildEmojis = Array.from(message.guild.emojis.cache);
      const emoji = guildEmojis.find((e) => e.name === emojiName);

      if (emoji) {
        const emojiId = emoji.id;
        description += ` <:${emojiName}:${emojiId}>`;
        fs.appendFile('emoji.json', `${emojiName}:${emojiId}\n`, (err) => {
          if (err) {
            console.error(err);
          } else {
            console.log(`Emoji data appended to emoji.json`);
          }
        });
      }
    });
  }

  return description;
}
function formatTime(ms) {
  if (ms <= 0) {
    return "";
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let timeString = "";
  if (days > 0) {
    timeString += `${days} дней `;
  }
  if (hours > 0) {
    timeString += `${hours} часов `;
  }
  if (minutes > 0) {
    timeString += `${minutes} минут `;
  }
  if (seconds > 0) {
    timeString += `${seconds} секунд`;
  }
  return timeString;
}
async function removePremium(userId) {
  const userData = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const premiumUsersData = JSON.parse(fs.readFileSync('premiumUsers.json', 'utf8'));

  if (userData[userId].premium) {
    userData[userId].premium = false;
    delete premiumUsersData[userId];
    fs.writeFileSync('users.json', JSON.stringify(userData, null, 2));
    fs.writeFileSync('premiumUsers.json', JSON.stringify(premiumUsersData, null, 2));
  }
}
client.login('Токен бота')