

const clientId = 'ID бота'
const TOKEN = 'Токен бота'
const { REST } = require('@discordjs/rest');
const rest = new REST();
rest.setToken(TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();