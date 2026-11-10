require("dotenv").config();

const { WebhookClient } = require("discord.js");
const { CONFIG } = require("./config");
const client = require("./bot");

const database = require("./database");
const { initDatabase, getPool, isGuildBanned } = database;

const { registerCommands, handleInteraction } = require("./commands");
const { handleMessage, resetSlowmodeForAllRelayChannels } = require("./relay");
const { setupWebServer } = require("./web");
const { connectConfiguredGuilds } = require("./voice");
const { store } = require("./store");
const { startSiteHeartbeat } = require("./site-sync");

const webhookClient = CONFIG.WEBHOOK_URL
  ? new WebhookClient({ url: CONFIG.WEBHOOK_URL })
  : null;

const app = setupWebServer(webhookClient);

client.once("ready", async () => {
  try {
    const db = getPool();

    await registerCommands();

    // Проверка забаненных серверов
    const [rows] = await db.query("SELECT guild_id FROM server_bans WHERE active=1");
    for (const row of rows) {
      const guild = client.guilds.cache.get(String(row.guild_id));
      if (guild) await guild.leave().catch(() => {});
    }

    // Подключение голосовых каналов (если включено)
    if (CONFIG.VOICE_ENABLED) {
      await connectConfiguredGuilds(client);
    }

    // Загрузка релейных каналов в store (если используется)
    if (store && typeof store === "object" && typeof database.loadRelayChannels === "function") {
      store.relayChannels = await database.loadRelayChannels();
    }

    // Принудительная установка slowmode = 15 для всех релейных каналов
    await resetSlowmodeForAllRelayChannels();

    console.log(`Discord: ${client.user.tag}`);
  } catch (error) {
    console.error("Bot init error:", error);
  }
});

client.on("interactionCreate", handleInteraction);
client.on("messageCreate", handleMessage);

client.on("guildCreate", async (guild) => {
  try {
    if (await isGuildBanned(guild.id)) {
      await guild.leave().catch(() => {});
    }
  } catch (error) {
    console.error("Guild ban check error:", error);
  }
});

// Автоматический сброс slowmode при изменении канала
client.on("channelUpdate", async (oldChannel, newChannel) => {
  if (!newChannel.isTextBased()) return;
  const { getRelayChannel } = require("./relay");
  const relayChannelId = await getRelayChannel(newChannel.guild.id);
  if (relayChannelId !== newChannel.id) return;
  if (newChannel.rateLimitPerUser !== 15) {
    try {
      await newChannel.setRateLimitPerUser(15);
      console.log(`Slowmode для канала ${newChannel.id} установлен в 15 секунд (был ${newChannel.rateLimitPerUser})`);
    } catch (e) {
      console.error(`Не удалось установить slowmode для канала ${newChannel.id}:`, e.message);
    }
  }
});

client.on("error", (error) => {
  console.error("Discord client error:", error);
});

app.listen(CONFIG.PORT, "0.0.0.0", async () => {
  console.log(`API: http://0.0.0.0:${CONFIG.PORT}`);
  startSiteHeartbeat();

  try {
    await initDatabase();
    console.log("Database initialized");
  } catch (error) {
    console.error("Database init failed:", error);
    return;
  }

  if (!CONFIG.TOKEN || CONFIG.TOKEN === "TEST_DISCORD_TOKEN_REPLACE_ME") {
    console.error("DISCORD_TOKEN не задан. Укажите его в .env");
    return;
  }

  client.login(CONFIG.TOKEN).catch((error) =>
    console.error("Discord login failed:", error.message)
  );
});